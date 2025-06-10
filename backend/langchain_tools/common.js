export class ConfirmationRequiredError extends Error {
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

// If you only have one export, you could also do:
// export default ConfirmationRequiredError;
// But keeping it as a named export is fine and consistent if there were other exports.
// For this case, as it's the only thing, let's make it a named export as it was.
// No, the original module.exports = { ConfirmationRequiredError } makes it a named export.
// So, `export { ConfirmationRequiredError };` or `export class ...` is correct.
// The `export class ...` is more direct.
