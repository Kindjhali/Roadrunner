import Conversation from './conversationSerializer';

describe('Conversation Serializer', () => {
  it('serializes and deserializes conversation correctly', () => {
    const convo = new Conversation('123');
    convo.addMessage('user', 'Hello');
    convo.addMessage('assistant', 'Hi there');

    const serialized = convo.serialize();
    const restored = Conversation.deserialize(serialized);

    expect(restored.id).toBe('123');
    expect(restored.messages.length).toBe(2);
    expect(restored.messages[0].text).toBe('Hello');
    expect(restored.messages[1].role).toBe('assistant');
  });
});
