import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import { Construct } from 'constructs';

export class BackendStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // ─── S3 Bucket for document storage ────────────────────────────────────
        const documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
            removalPolicy: cdk.RemovalPolicy.RETAIN,          // keep data on stack delete
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // never publicly readable
            encryption: s3.BucketEncryption.S3_MANAGED,
            versioned: true,
        });

        // ─── Document Upload Lambda ─────────────────────────────────────────────
        // Computes SHA-256, records mock blockchain txId, uploads file to S3
        const documentUploadLambda = new lambda.Function(this, 'DocumentUploadLambda', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'handler.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/document-upload')),
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            environment: {
                DOCUMENT_BUCKET: documentsBucket.bucketName,
                NODE_OPTIONS: '--enable-source-maps',
            },
        });

        // Grant the Lambda write access to the S3 bucket
        documentsBucket.grantWrite(documentUploadLambda);

        // ─── API Gateway ────────────────────────────────────────────────────────
        const api = new apigateway.RestApi(this, 'SchemeSetuApi', {
            restApiName: 'SchemeSetu API',
            description: 'API for SchemeSetu AI — document upload with blockchain anchoring',
            deployOptions: {
                stageName: 'prod',
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: true,
            },
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: [
                    'Content-Type',
                    'Authorization',
                    'X-Amz-Date',
                    'X-Api-Key',
                    'X-Amz-Security-Token',
                ],
            },
        });

        // POST /documents  →  DocumentUploadLambda
        const documents = api.root.addResource('documents');
        documents.addMethod(
            'POST',
            new apigateway.LambdaIntegration(documentUploadLambda, {
                requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
            })
        );

        // ─── Stack Outputs ──────────────────────────────────────────────────────
        new cdk.CfnOutput(this, 'ApiUrl', {
            value: api.url,
            description: 'Base URL for the SchemeSetu API Gateway',
            exportName: 'SchemeSetuApiUrl',
        });

        new cdk.CfnOutput(this, 'DocumentsBucketName', {
            value: documentsBucket.bucketName,
            description: 'S3 bucket where uploaded documents are stored',
            exportName: 'SchemeSetuDocumentsBucket',
        });

        new cdk.CfnOutput(this, 'UploadEndpoint', {
            value: `${api.url}documents`,
            description: 'Full POST endpoint for document upload (NEXT_PUBLIC_API_URL value)',
            exportName: 'SchemeSetuUploadEndpoint',
        });
    }
}
