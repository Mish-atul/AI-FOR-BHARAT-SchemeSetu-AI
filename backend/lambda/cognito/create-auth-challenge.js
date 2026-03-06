// SchemeSetu AI — Cognito Create Auth Challenge
// Generates OTP and sends via Amazon SNS
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const sns = new SNSClient({ region: process.env.REGION || 'ap-south-1' });

exports.handler = async (event) => {
  if (event.request.challengeName === 'CUSTOM_CHALLENGE') {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const phoneNumber = event.request.userAttributes.phone_number;

    // Send OTP via Amazon SNS
    try {
      await sns.send(new PublishCommand({
        PhoneNumber: phoneNumber,
        Message: `Your SchemeSetu AI verification code is: ${otp}. Valid for 5 minutes.`,
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
      console.log(`OTP sent to ${phoneNumber}`);
    } catch (err) {
      console.error('SNS send error:', err);
      // For hackathon demo: continue even if SMS fails (OTP still works via challenge)
    }

    // Set challenge parameters
    event.response.publicChallengeParameters = {
      phone: phoneNumber,
    };
    event.response.privateChallengeParameters = {
      otp,
    };
    event.response.challengeMetadata = 'OTP_CHALLENGE';
  }

  return event;
};
