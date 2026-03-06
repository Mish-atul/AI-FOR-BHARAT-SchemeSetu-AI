// SchemeSetu AI — Cognito Verify Auth Challenge Response
// Checks if the user's OTP matches the generated one
exports.handler = async (event) => {
  const expectedOtp = event.request.privateChallengeParameters?.otp;
  const userOtp = event.request.challengeAnswer;

  event.response.answerCorrect = expectedOtp === userOtp;

  return event;
};
