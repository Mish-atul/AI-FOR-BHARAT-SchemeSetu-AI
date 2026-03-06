// SchemeSetu AI — Auth Lambda (OTP via Amazon SNS + Profile)
const crypto = require('crypto');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { ddb, GetCommand, PutCommand, QueryCommand, UpdateCommand, response, parseBody, getPhoneNumber } = require('../shared/utils');

const sns = new SNSClient({ region: process.env.REGION || 'ap-south-1' });
const SESSIONS_TABLE = process.env.SESSIONS_TABLE;
const USERS_TABLE = process.env.USERS_TABLE;

// Generate a random 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

exports.handler = async (event) => {
  const method = event.httpMethod;
  const path = event.resource;
  const body = parseBody(event);

  try {
    // POST /auth/otp — Request OTP
    if (path === '/auth/otp' && method === 'POST') {
      const { phoneNumber } = body;
      if (!phoneNumber || !/^\+91\d{10}$/.test(phoneNumber)) {
        return response(400, { error: 'Invalid phone number. Use +91XXXXXXXXXX format.' });
      }

      const otp = generateOTP();
      const sessionId = crypto.randomUUID();
      const ttl = Math.floor(Date.now() / 1000) + 300; // 5 min expiry

      await ddb.send(new PutCommand({
        TableName: SESSIONS_TABLE,
        Item: {
          PK: `OTP#${phoneNumber}`,
          otp,
          sessionId,
          ttl,
          createdAt: Date.now(),
        },
      }));

      // Send OTP via Amazon SNS
      let smsSent = false;
      try {
        await sns.send(new PublishCommand({
          PhoneNumber: phoneNumber,
          Message: `Your SchemeSetu AI verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`,
          MessageAttributes: {
            'AWS.SNS.SMS.SenderID': {
              DataType: 'String',
              StringValue: 'SchemeSetu',
            },
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Transactional',
            },
          },
        }));
        smsSent = true;
        console.log(`OTP SMS sent to ${phoneNumber}`);
      } catch (snsErr) {
        console.error('SNS SMS error:', snsErr.message);
        // SMS failed (sandbox mode) — continue with demo fallback
      }

      const result = { message: 'OTP sent successfully', sessionId, smsSent };
      // Always include OTP for hackathon demo (SNS sandbox may silently drop SMS)
      result.demoOtp = otp;
      if (!smsSent) {
        result.note = 'SMS delivery failed — use demoOtp to login';
      }
      return response(200, result);
    }

    // POST /auth/otp/verify — Verify OTP
    if (path === '/auth/otp/verify' && method === 'POST') {
      const { phoneNumber, otp } = body;
      if (!phoneNumber || !otp) {
        return response(400, { error: 'Phone number and OTP required.' });
      }

      // Check OTP
      const otpResult = await ddb.send(new GetCommand({
        TableName: SESSIONS_TABLE,
        Key: { PK: `OTP#${phoneNumber}` },
      }));

      if (!otpResult.Item || otpResult.Item.otp !== otp) {
        return response(401, { error: 'Invalid OTP' });
      }

      // Check if user exists
      const userResult = await ddb.send(new GetCommand({
        TableName: USERS_TABLE,
        Key: { PK: `USER#${phoneNumber}`, SK: 'PROFILE' },
      }));

      const isNewUser = !userResult.Item;
      const userId = isNewUser ? `user_${crypto.randomUUID().substring(0, 8)}` : userResult.Item.userId;

      // Create user if new
      if (isNewUser) {
        await ddb.send(new PutCommand({
          TableName: USERS_TABLE,
          Item: {
            PK: `USER#${phoneNumber}`,
            SK: 'PROFILE',
            userId,
            phoneNumber,
            createdAt: Date.now(),
            lastLoginAt: Date.now(),
            language: 'en',
            profile: {},
            trustScore: 0,
            consentVersion: '',
            deleted: false,
          },
        }));
      } else {
        await ddb.send(new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { PK: `USER#${phoneNumber}`, SK: 'PROFILE' },
          UpdateExpression: 'SET lastLoginAt = :now',
          ExpressionAttributeValues: { ':now': Date.now() },
        }));
      }

      // Create session token
      const token = crypto.randomBytes(32).toString('hex');
      const tokenTtl = Math.floor(Date.now() / 1000) + 86400 * 7; // 7 days

      await ddb.send(new PutCommand({
        TableName: SESSIONS_TABLE,
        Item: {
          PK: `TOKEN#${token}`,
          userId,
          phoneNumber,
          ttl: tokenTtl,
          createdAt: Date.now(),
        },
      }));

      return response(200, {
        token,
        userId,
        isNewUser,
        requiresConsent: isNewUser || !userResult.Item?.consentVersion,
      });
    }

    // GET /profile
    if (path === '/profile' && method === 'GET') {
      const userId = event.requestContext?.authorizer?.claims?.sub || event.requestContext?.authorizer?.userId;
      const phone = getPhoneNumber(event);
      
      const result = await ddb.send(new GetCommand({
        TableName: USERS_TABLE,
        Key: { PK: `USER#${phone}`, SK: 'PROFILE' },
      }));

      if (!result.Item) return response(404, { error: 'User not found' });
      return response(200, result.Item);
    }

    // PUT /profile
    if (path === '/profile' && method === 'PUT') {
      const phone = getPhoneNumber(event);
      // Frontend may send { profile: {...} } or flat fields
      const profileData = body.profile || body;
      const { name, occupation, district, state, pincode, age, monthlyIncome } = profileData;

      // Filter out undefined values
      const profile = {};
      if (name !== undefined) profile.name = name;
      if (occupation !== undefined) profile.occupation = occupation;
      if (district !== undefined) profile.district = district;
      if (state !== undefined) profile.state = state;
      if (pincode !== undefined) profile.pincode = pincode;
      if (age !== undefined) profile.age = age;
      if (monthlyIncome !== undefined) profile.monthlyIncome = monthlyIncome;

      const result = await ddb.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { PK: `USER#${phone}`, SK: 'PROFILE' },
        UpdateExpression: 'SET #profile = :profile',
        ExpressionAttributeNames: { '#profile': 'profile' },
        ExpressionAttributeValues: {
          ':profile': profile,
        },
        ReturnValues: 'ALL_NEW',
      }));

      return response(200, result.Attributes);
    }

    return response(404, { error: 'Route not found' });
  } catch (err) {
    console.error('Auth error:', err);
    return response(500, { error: 'Internal server error' });
  }
};
