#!/bin/bash
# Build Celebrations for the server and deploy it to AWS.
#
#   deploy/deploy.sh            first run creates everything; later runs ship a new build
#
# Uses the AWS CLI profile in $AWS_PROFILE (default: celebrations) and its default Region.
set -euo pipefail

cd "$(dirname "$0")/.."
export AWS_PROFILE="${AWS_PROFILE:-celebrations}"
STACK=celebrations
REGION="$(aws configure get region)"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="celebrations-app-${ACCOUNT}-${REGION}"

echo "==> Building for linux/arm64"
mkdir -p deploy/build
GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o deploy/build/celebrations .

PREFIX_LIST="$(aws ec2 describe-managed-prefix-lists --region "$REGION" \
  --filters Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing \
  --query 'PrefixLists[0].PrefixListId' --output text)"
PARAMS="ParameterKey=CloudFrontPrefixList,ParameterValue=${PREFIX_LIST}"

upload() {
  aws s3 cp deploy/build/celebrations "s3://${BUCKET}/celebrations" --region "$REGION" --only-show-errors
  aws s3 cp deploy/server-setup.sh "s3://${BUCKET}/server-setup.sh" --region "$REGION" --only-show-errors
}

if ! aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" >/dev/null 2>&1; then
  echo "==> Creating the stack (CloudFront takes a few minutes)"
  aws cloudformation create-stack --region "$REGION" --stack-name "$STACK" \
    --template-body file://deploy/template.yaml --parameters "$PARAMS" \
    --capabilities CAPABILITY_IAM --tags Key=app,Value=celebrations >/dev/null
  # The server waits for the binary on first boot, so upload as soon as the bucket exists.
  aws s3api wait bucket-exists --bucket "$BUCKET" --region "$REGION"
  upload
  aws cloudformation wait stack-create-complete --region "$REGION" --stack-name "$STACK"
else
  echo "==> Updating the stack"
  aws cloudformation deploy --region "$REGION" --stack-name "$STACK" \
    --template-file deploy/template.yaml --parameter-overrides "CloudFrontPrefixList=${PREFIX_LIST}" \
    --capabilities CAPABILITY_IAM --no-fail-on-empty-changeset
  upload
fi

# Settings from .env go to Parameter Store, where the server reads them. Values are passed by
# file so they never appear on a command line or in this script's output.
setting() { sed -n "s/^$1=//p" .env 2>/dev/null | tail -1 | tr -d '\r' | sed -e "s/^[\"']//" -e "s/[\"']\$//"; }
store() { # store <parameter name> <type> <value>
  local tmp; tmp="$(mktemp)"; chmod 600 "$tmp"; printf '%s' "$3" >"$tmp"
  aws ssm put-parameter --region "$REGION" --name "$1" --type "$2" --overwrite --value "file://$tmp" >/dev/null
  rm -f "$tmp"
}
if [ -n "$(setting GEMINI_API_KEY)" ]; then
  echo "==> Storing the Gemini key from .env in Parameter Store"
  store /celebrations/gemini-api-key SecureString "$(setting GEMINI_API_KEY)"
fi
case "$(setting MONGODB_URI)" in
  "") ;;
  *"<db_password>"*) echo "==> MONGODB_URI in .env still has <db_password> in it; not storing it" ;;
  *)
    echo "==> Storing the MongoDB connection string from .env in Parameter Store"
    store /celebrations/mongodb-uri SecureString "$(setting MONGODB_URI)"
    ;;
esac
if [ -n "$(setting GEMINI_MODEL)" ]; then
  store /celebrations/gemini-model String "$(setting GEMINI_MODEL)"
fi

# Configure the server and (re)start the app with this build. On a brand-new server the first
# boot has already started the app; this run brings its settings in line with server-setup.sh.
SERVER="$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='ServerId'].OutputValue" --output text)"
echo "==> Setting up ${SERVER} and restarting the app"
until [ "$(aws ssm describe-instance-information --region "$REGION" \
  --filters "Key=InstanceIds,Values=${SERVER}" --query 'length(InstanceInformationList)' --output text)" = 1 ]; do
  sleep 10   # a new server takes a minute to report in to Systems Manager
done
CMD="$(aws ssm send-command --region "$REGION" --instance-ids "$SERVER" --document-name AWS-RunShellScript \
  --parameters "commands=[\"aws s3 cp s3://${BUCKET}/server-setup.sh /root/server-setup.sh --region ${REGION} --only-show-errors\",\"bash /root/server-setup.sh ${BUCKET} ${REGION}\"]" \
  --query Command.CommandId --output text)"
aws ssm wait command-executed --region "$REGION" --command-id "$CMD" --instance-id "$SERVER" || true
aws ssm get-command-invocation --region "$REGION" --command-id "$CMD" --instance-id "$SERVER" \
  --query '[Status, StandardOutputContent, StandardErrorContent]' --output text

URL="$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='Url'].OutputValue" --output text)"
echo
echo "Celebrations is live at: ${URL}"
