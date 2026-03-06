import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as path from 'path';

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ================================================================
    // KMS KEY — Encryption for all data at rest
    // ================================================================
    const encryptionKey = new kms.Key(this, 'SchemeSetuKey', {
      alias: 'schemesetu-encryption',
      description: 'Encryption key for SchemeSetu AI data',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ================================================================
    // S3 BUCKET — Document storage with encryption
    // ================================================================
    const documentBucket = new s3.Bucket(this, 'DocumentBucket', {
      encryption: s3.BucketEncryption.KMS,
      encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [{
        allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      }],
      lifecycleRules: [{
        id: 'move-to-ia',
        transitions: [{
          storageClass: s3.StorageClass.INFREQUENT_ACCESS,
          transitionAfter: cdk.Duration.days(90),
        }],
      }],
    });

    // ================================================================
    // DYNAMODB TABLES
    // ================================================================

    // Users table
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'schemesetu-users',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Documents table
    const documentsTable = new dynamodb.Table(this, 'DocumentsTable', {
      tableName: 'schemesetu-documents',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    documentsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    // Ledger table (Immutable — replaces QLDB)
    const ledgerTable = new dynamodb.Table(this, 'LedgerTable', {
      tableName: 'schemesetu-ledger',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Consent table
    const consentTable = new dynamodb.Table(this, 'ConsentTable', {
      tableName: 'schemesetu-consent',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Sessions table (for OTP / auth tokens)
    const sessionsTable = new dynamodb.Table(this, 'SessionsTable', {
      tableName: 'schemesetu-sessions',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Schemes table (stores government scheme data)
    const schemesTable = new dynamodb.Table(this, 'SchemesTable', {
      tableName: 'schemesetu-schemes',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ================================================================
    // SQS QUEUE — OCR processing queue
    // ================================================================
    const ocrQueue = new sqs.Queue(this, 'OcrQueue', {
      queueName: 'schemesetu-ocr-queue',
      visibilityTimeout: cdk.Duration.seconds(300),
      retentionPeriod: cdk.Duration.days(7),
      deadLetterQueue: {
        queue: new sqs.Queue(this, 'OcrDLQ', {
          queueName: 'schemesetu-ocr-dlq',
          retentionPeriod: cdk.Duration.days(14),
        }),
        maxReceiveCount: 3,
      },
    });

    // ================================================================
    // LAMBDA COMMON SETTINGS
    // ================================================================
    const lambdaDir = path.join(__dirname, '..', 'lambda');

    const commonEnv: { [key: string]: string } = {
      USERS_TABLE: usersTable.tableName,
      DOCUMENTS_TABLE: documentsTable.tableName,
      LEDGER_TABLE: ledgerTable.tableName,
      CONSENT_TABLE: consentTable.tableName,
      SESSIONS_TABLE: sessionsTable.tableName,
      SCHEMES_TABLE: schemesTable.tableName,
      DOCUMENT_BUCKET: documentBucket.bucketName,
      KMS_KEY_ID: encryptionKey.keyId,
      OCR_QUEUE_URL: ocrQueue.queueUrl,
      REGION: this.region,
    };

    const lambdaDefaults = {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: commonEnv,
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
    };

    // ================================================================
    // LAMBDA FUNCTIONS
    // ================================================================

    // Auth Lambda
    const authFn = new lambda.Function(this, 'AuthFn', {
      ...lambdaDefaults,
      functionName: 'schemesetu-auth',
      handler: 'auth/auth.handler',
      code: lambda.Code.fromAsset(lambdaDir),
    });
    sessionsTable.grantReadWriteData(authFn);
    usersTable.grantReadWriteData(authFn);
    authFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sns:Publish'],
      resources: ['*'],
    }));

    // Document Upload Lambda
    const documentFn = new lambda.Function(this, 'DocumentFn', {
      ...lambdaDefaults,
      functionName: 'schemesetu-documents',
      handler: 'documents/documents.handler',
      timeout: cdk.Duration.seconds(60),
      code: lambda.Code.fromAsset(lambdaDir),
    });
    documentsTable.grantReadWriteData(documentFn);
    ledgerTable.grantReadWriteData(documentFn);
    documentBucket.grantReadWrite(documentFn);
    encryptionKey.grantEncryptDecrypt(documentFn);
    ocrQueue.grantSendMessages(documentFn);

    // OCR Processing Lambda (triggered by SQS)
    const ocrFn = new lambda.Function(this, 'OcrFn', {
      ...lambdaDefaults,
      functionName: 'schemesetu-ocr',
      handler: 'ocr/ocr.handler',
      timeout: cdk.Duration.seconds(120),
      memorySize: 512,
      code: lambda.Code.fromAsset(lambdaDir),
    });
    ocrFn.addEventSource(new lambdaEventSources.SqsEventSource(ocrQueue, {
      batchSize: 1,
    }));
    documentsTable.grantReadWriteData(ocrFn);
    documentBucket.grantRead(ocrFn);
    encryptionKey.grantDecrypt(ocrFn);
    ocrFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['textract:AnalyzeDocument', 'textract:DetectDocumentText'],
      resources: ['*'],
    }));

    // Chatbot Lambda
    const chatbotFn = new lambda.Function(this, 'ChatbotFn', {
      ...lambdaDefaults,
      functionName: 'schemesetu-chatbot',
      handler: 'chatbot/chatbot.handler',
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      code: lambda.Code.fromAsset(lambdaDir),
    });
    documentsTable.grantReadData(chatbotFn);
    usersTable.grantReadData(chatbotFn);
    schemesTable.grantReadData(chatbotFn);
    chatbotFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['*'],
    }));
    chatbotFn.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'transcribe:StartTranscriptionJob', 'transcribe:GetTranscriptionJob',
        'polly:SynthesizeSpeech',
      ],
      resources: ['*'],
    }));
    documentBucket.grantReadWrite(chatbotFn);
    encryptionKey.grantEncryptDecrypt(chatbotFn);

    // Schemes Lambda
    const schemesFn = new lambda.Function(this, 'SchemesFn', {
      ...lambdaDefaults,
      functionName: 'schemesetu-schemes',
      handler: 'schemes/schemes.handler',
      code: lambda.Code.fromAsset(lambdaDir),
    });
    schemesTable.grantReadData(schemesFn);
    usersTable.grantReadData(schemesFn);
    documentsTable.grantReadData(schemesFn);

    // Reports Lambda
    const reportsFn = new lambda.Function(this, 'ReportsFn', {
      ...lambdaDefaults,
      functionName: 'schemesetu-reports',
      handler: 'reports/reports.handler',
      code: lambda.Code.fromAsset(lambdaDir),
    });
    documentsTable.grantReadData(reportsFn);
    ledgerTable.grantReadWriteData(reportsFn);
    usersTable.grantReadData(reportsFn);

    // Verification Lambda (public)
    const verifyFn = new lambda.Function(this, 'VerifyFn', {
      ...lambdaDefaults,
      functionName: 'schemesetu-verify',
      handler: 'verify/verify.handler',
      code: lambda.Code.fromAsset(lambdaDir),
    });
    ledgerTable.grantReadData(verifyFn);

    // Consent Lambda
    const consentFn = new lambda.Function(this, 'ConsentFn', {
      ...lambdaDefaults,
      functionName: 'schemesetu-consent',
      handler: 'consent/consent.handler',
      code: lambda.Code.fromAsset(lambdaDir),
    });
    consentTable.grantReadWriteData(consentFn);
    ledgerTable.grantReadWriteData(consentFn);
    usersTable.grantReadWriteData(consentFn);

    // CSC Portal Lambda
    const cscFn = new lambda.Function(this, 'CscFn', {
      ...lambdaDefaults,
      functionName: 'schemesetu-csc',
      handler: 'csc/csc.handler',
      code: lambda.Code.fromAsset(lambdaDir),
    });
    documentsTable.grantReadWriteData(cscFn);
    ledgerTable.grantReadWriteData(cscFn);

    // Account Deletion Lambda
    const deletionFn = new lambda.Function(this, 'DeletionFn', {
      ...lambdaDefaults,
      functionName: 'schemesetu-deletion',
      handler: 'deletion/deletion.handler',
      timeout: cdk.Duration.seconds(120),
      code: lambda.Code.fromAsset(lambdaDir),
    });
    usersTable.grantReadWriteData(deletionFn);
    documentsTable.grantReadWriteData(deletionFn);
    consentTable.grantReadWriteData(deletionFn);
    ledgerTable.grantReadWriteData(deletionFn);
    sessionsTable.grantReadWriteData(deletionFn);
    documentBucket.grantDelete(deletionFn);
    documentBucket.grantRead(deletionFn);
    encryptionKey.grantDecrypt(deletionFn);

    // ================================================================
    // API GATEWAY
    // ================================================================

    // API Gateway account-level CloudWatch role (required for logging)
    const apiGwRole = new iam.Role(this, 'ApiGatewayCloudWatchRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromManagedPolicyArn(this, 'ApiGwCwPolicy', 'arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs'),
      ],
    });
    const apiGwAccount = new apigateway.CfnAccount(this, 'ApiGatewayAccount', {
      cloudWatchRoleArn: apiGwRole.roleArn,
    });

    const api = new apigateway.RestApi(this, 'SchemeSetuApi', {
      restApiName: 'SchemeSetu API',
      description: 'SchemeSetu AI Backend API',
      deployOptions: {
        stageName: 'prod',
        throttlingBurstLimit: 50,
        throttlingRateLimit: 100,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        tracingEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Language'],
      },
    });
    // Ensure API Gateway account settings are applied before deploying the API stage
    api.node.addDependency(apiGwAccount);

    // Token authorizer
    const authorizerFn = new lambda.Function(this, 'AuthorizerFn', {
      ...lambdaDefaults,
      functionName: 'schemesetu-authorizer',
      handler: 'auth/authorizer.handler',
      code: lambda.Code.fromAsset(lambdaDir),
    });
    sessionsTable.grantReadData(authorizerFn);

    const tokenAuthorizer = new apigateway.TokenAuthorizer(this, 'TokenAuth', {
      handler: authorizerFn,
      identitySource: 'method.request.header.Authorization',
      resultsCacheTtl: cdk.Duration.minutes(5),
    });

    // Auth endpoints (no auth)
    const authResource = api.root.addResource('auth');
    const otpResource = authResource.addResource('otp');
    otpResource.addMethod('POST', new apigateway.LambdaIntegration(authFn));
    const otpVerify = otpResource.addResource('verify');
    otpVerify.addMethod('POST', new apigateway.LambdaIntegration(authFn));

    // Profile endpoints
    const profileResource = api.root.addResource('profile');
    profileResource.addMethod('GET', new apigateway.LambdaIntegration(authFn), { authorizer: tokenAuthorizer });
    profileResource.addMethod('PUT', new apigateway.LambdaIntegration(authFn), { authorizer: tokenAuthorizer });

    // Document endpoints
    const docsResource = api.root.addResource('documents');
    docsResource.addMethod('GET', new apigateway.LambdaIntegration(documentFn), { authorizer: tokenAuthorizer });
    docsResource.addMethod('POST', new apigateway.LambdaIntegration(documentFn), { authorizer: tokenAuthorizer });
    const docById = docsResource.addResource('{docId}');
    docById.addMethod('GET', new apigateway.LambdaIntegration(documentFn), { authorizer: tokenAuthorizer });

    // Chat endpoints
    const chatResource = api.root.addResource('chat');
    chatResource.addMethod('POST', new apigateway.LambdaIntegration(chatbotFn), { authorizer: tokenAuthorizer });
    const voiceResource = chatResource.addResource('voice');
    voiceResource.addMethod('POST', new apigateway.LambdaIntegration(chatbotFn), { authorizer: tokenAuthorizer });

    // Scheme endpoints
    const schemesResource = api.root.addResource('schemes');
    schemesResource.addMethod('GET', new apigateway.LambdaIntegration(schemesFn), { authorizer: tokenAuthorizer });
    const schemeEligibility = schemesResource.addResource('eligible');
    schemeEligibility.addMethod('GET', new apigateway.LambdaIntegration(schemesFn), { authorizer: tokenAuthorizer });

    // Report endpoints
    const reportsResource = api.root.addResource('reports');
    reportsResource.addMethod('GET', new apigateway.LambdaIntegration(reportsFn), { authorizer: tokenAuthorizer });
    reportsResource.addMethod('POST', new apigateway.LambdaIntegration(reportsFn), { authorizer: tokenAuthorizer });

    // Verify endpoints (public)
    const verifyResource = api.root.addResource('verify');
    const verifyById = verifyResource.addResource('{reportId}');
    verifyById.addMethod('GET', new apigateway.LambdaIntegration(verifyFn));

    // Consent endpoints
    const consentResource = api.root.addResource('consent');
    consentResource.addMethod('GET', new apigateway.LambdaIntegration(consentFn), { authorizer: tokenAuthorizer });
    consentResource.addMethod('POST', new apigateway.LambdaIntegration(consentFn), { authorizer: tokenAuthorizer });

    // CSC Portal endpoints
    const cscResource = api.root.addResource('csc');
    const cscQueueRes = cscResource.addResource('queue');
    cscQueueRes.addMethod('GET', new apigateway.LambdaIntegration(cscFn), { authorizer: tokenAuthorizer });
    const cscById = cscQueueRes.addResource('{docId}');
    cscById.addMethod('PUT', new apigateway.LambdaIntegration(cscFn), { authorizer: tokenAuthorizer });

    // Account Deletion
    const accountResource = api.root.addResource('account');
    accountResource.addMethod('DELETE', new apigateway.LambdaIntegration(deletionFn), { authorizer: tokenAuthorizer });

    // ================================================================
    // OUTPUTS
    // ================================================================
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });
    new cdk.CfnOutput(this, 'DocumentBucketName', {
      value: documentBucket.bucketName,
      description: 'S3 Document Bucket',
    });
    new cdk.CfnOutput(this, 'KmsKeyId', {
      value: encryptionKey.keyId,
      description: 'KMS Encryption Key ID',
    });
  }
}
