// SchemeSetu AI — Cognito Define Auth Challenge
// Controls the custom auth flow for passwordless OTP
exports.handler = async (event) => {
  const session = event.request.session || [];

  if (session.length === 0) {
    // First round — issue a custom OTP challenge
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
    event.response.challengeName = 'CUSTOM_CHALLENGE';
  } else if (
    session.length === 1 &&
    session[0].challengeName === 'CUSTOM_CHALLENGE' &&
    session[0].challengeResult === true
  ) {
    // OTP verified — issue tokens
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
  } else {
    // Wrong OTP or too many attempts — fail
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
  }

  return event;
};
