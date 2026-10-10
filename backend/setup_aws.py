#!/usr/bin/env python3
"""
HeatPath AWS Infrastructure Setup
Creates DynamoDB tables and verifies Bedrock access.
Run: python setup_aws.py
"""

import boto3
import json
import os
from dotenv import load_dotenv

load_dotenv()

REGION = os.getenv("AWS_REGION", "us-east-1")
ACCESS_KEY = os.getenv("AWS_ACCESS_KEY_ID")
SECRET_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")

session = boto3.Session(
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    region_name=REGION,
)

dynamodb = session.client("dynamodb")
bedrock = session.client("bedrock-runtime")


def create_water_points_table():
    """DynamoDB table to cache water point data."""
    table_name = "heatpath-water-points"
    try:
        dynamodb.create_table(
            TableName=table_name,
            KeySchema=[
                {"AttributeName": "location_key", "KeyType": "HASH"},
                {"AttributeName": "point_id", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "location_key", "AttributeType": "S"},
                {"AttributeName": "point_id", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
            Tags=[
                {"Key": "Project", "Value": "HeatPath"},
                {"Key": "Environment", "Value": "hackathon"},
            ],
        )
        print(f"✅ Created DynamoDB table: {table_name}")
    except dynamodb.exceptions.ResourceInUseException:
        print(f"ℹ️  Table already exists: {table_name}")


def create_route_cache_table():
    """DynamoDB table to cache computed route results (TTL-based)."""
    table_name = "heatpath-route-cache"
    try:
        dynamodb.create_table(
            TableName=table_name,
            KeySchema=[
                {"AttributeName": "route_key", "KeyType": "HASH"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "route_key", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
            Tags=[
                {"Key": "Project", "Value": "HeatPath"},
                {"Key": "Environment", "Value": "hackathon"},
            ],
        )
        print(f"⏳ Waiting for {table_name} to become active...")
        waiter = dynamodb.get_waiter("table_exists")
        waiter.wait(TableName=table_name)

        # Enable TTL for automatic cache expiry
        try:
            dynamodb.update_time_to_live(
                TableName=table_name,
                TimeToLiveSpecification={"Enabled": True, "AttributeName": "ttl"},
            )
            print(f"✅ Created DynamoDB table with TTL: {table_name}")
        except Exception:
            print(f"✅ Created DynamoDB table: {table_name} (TTL can be enabled in console)")
    except dynamodb.exceptions.ResourceInUseException:
        print(f"ℹ️  Table already exists: {table_name}")


def test_bedrock_access():
    """Test AWS Bedrock (Claude Haiku) access."""
    print("\n🔍 Testing AWS Bedrock access...")
    try:
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 50,
            "messages": [
                {
                    "role": "user",
                    "content": "Say 'HeatPath Bedrock OK' in exactly 4 words.",
                }
            ],
        })
        response = bedrock.invoke_model(
            modelId="anthropic.claude-3-haiku-20240307-v1:0",
            body=body,
            contentType="application/json",
            accept="application/json",
        )
        result = json.loads(response["body"].read())
        text = result["content"][0]["text"]
        print(f"✅ Bedrock response: {text}")
    except Exception as e:
        print(f"⚠️  Bedrock not accessible (will use fallback): {e}")
        print("   → Enable Claude 3 Haiku in AWS Bedrock Model Access console.")


def create_iam_policy():
    """Print the least-privilege IAM policy for Lambda."""
    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "BedrockInference",
                "Effect": "Allow",
                "Action": ["bedrock:InvokeModel"],
                "Resource": [
                    f"arn:aws:bedrock:{REGION}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
                ],
            },
            {
                "Sid": "DynamoDBAccess",
                "Effect": "Allow",
                "Action": [
                    "dynamodb:GetItem",
                    "dynamodb:PutItem",
                    "dynamodb:Query",
                    "dynamodb:Scan",
                    "dynamodb:UpdateItem",
                ],
                "Resource": [
                    f"arn:aws:dynamodb:{REGION}:*:table/heatpath-*"
                ],
            },
            {
                "Sid": "CloudWatchLogs",
                "Effect": "Allow",
                "Action": [
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents",
                ],
                "Resource": "arn:aws:logs:*:*:*",
            },
        ],
    }
    print("\n📋 IAM Policy for Lambda (least-privilege):")
    print(json.dumps(policy, indent=2))


if __name__ == "__main__":
    print("🚀 HeatPath AWS Setup\n" + "=" * 40)
    create_water_points_table()
    create_route_cache_table()
    test_bedrock_access()
    create_iam_policy()
    print("\n✅ Setup complete! Next: copy backend/.env.example to backend/.env and fill in your AWS credentials.")
