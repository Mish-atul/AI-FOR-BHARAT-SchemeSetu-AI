// SchemeSetu AI — Cognito Pre-SignUp Trigger
// Auto-confirms users so OTP is the only verification
exports.handler = async (event) => {
  event.response.autoConfirmUser = true;
  event.response.autoVerifyPhone = true;
  return event;
};
