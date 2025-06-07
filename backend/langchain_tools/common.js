class ConfirmationRequiredError extends Error {
  constructor(data, ...params) {
    super(...params);
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfirmationRequiredError);
    }
    this.name = 'ConfirmationRequiredError';
    this.data = data; // Expected to be { toolName, toolInput, confirmationId }
  }
}

module.exports = {
  ConfirmationRequiredError,
};
