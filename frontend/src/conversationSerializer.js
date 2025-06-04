// Simple Conversation and serializer utilities
export default class Conversation {
  constructor(id, messages = []) {
    this.id = id;
    this.messages = messages;
  }

  addMessage(role, text, timestamp = new Date().toISOString(), metadata = {}) {
    this.messages.push({ role, text, timestamp, ...metadata });
  }

  // Serialize conversation to JSON string
  serialize() {
    return JSON.stringify({ id: this.id, messages: this.messages });
  }

  // Deserialize JSON string back to Conversation instance
  static deserialize(jsonString) {
    const data = JSON.parse(jsonString);
    return new Conversation(data.id, data.messages || []);
  }
}
