import RoadmapParser from './RoadmapParser';

describe('RoadmapParser', () => {
  it('should parse a complete sniper file', () => {
    const sniperFileContent = `
## 📌 Summary

This is a summary of the module.

## 🧾 Metadata

| Key         | Value       |
| ----------- | ----------- |
| Version     | 1.0         |
| Author      | John Doe    |

## 🧠 Responsibilities

- Handle user authentication
- Manage user profiles

## 🔌 Integration Points

| Linked Module | Purpose    | Status      |
| ------------- | ---------- | ----------- |
| Auth Service  | SSO        | Implemented |
| User Service  | Profile data | Planned     |

## 🔮 Future Features

- Two-factor authentication
- Profile picture uploads
`;
    const parser = new RoadmapParser(sniperFileContent);
    const parsedData = parser.parse();

    expect(parsedData.summary).toBe('This is a summary of the module.');

    expect(parsedData.metadata).toEqual({
      Version: '1.0',
      Author: 'John Doe',
    });

    expect(parsedData.responsibilities).toEqual([
      'Handle user authentication',
      'Manage user profiles',
    ]);

    expect(parsedData.integrationPoints).toEqual([
      { 'Linked Module': 'Auth Service', Purpose: 'SSO', Status: 'Implemented' },
      { 'Linked Module': 'User Service', Purpose: 'Profile data', Status: 'Planned' },
    ]);

    expect(parsedData.futureFeatures).toEqual([
      'Two-factor authentication',
      'Profile picture uploads',
    ]);
  });

  it('should handle missing optional sections gracefully', () => {
    const sniperFileContent = `
## 📌 Summary

This is a summary of the module.

## 🧾 Metadata

| Key         | Value       |
| ----------- | ----------- |
| Version     | 1.0         |
`;
    const parser = new RoadmapParser(sniperFileContent);
    const parsedData = parser.parse();

    expect(parsedData.summary).toBe('This is a summary of the module.');
    expect(parsedData.metadata).toEqual({ Version: '1.0' });
    expect(parsedData.responsibilities).toEqual([]);
    expect(parsedData.integrationPoints).toEqual([]);
    expect(parsedData.futureFeatures).toEqual([]);
  });

  it('should correctly parse the Metadata table', () => {
    const sniperFileContent = `
## 🧾 Metadata

| Key         | Value       |
| ----------- | ----------- |
| Maintainer  | Jane Doe    |
| Updated     | 2023-10-26  |
`;
    const parser = new RoadmapParser(sniperFileContent);
    const parsedData = parser.parse();

    expect(parsedData.metadata).toEqual({
      Maintainer: 'Jane Doe',
      Updated: '2023-10-26',
    });
  });

  it('should correctly parse Responsibilities lists', () => {
    const sniperFileContent = `
## 🧠 Responsibilities

- First responsibility
- Second responsibility
* Third responsibility (using asterisk)
`;
    const parser = new RoadmapParser(sniperFileContent);
    const parsedData = parser.parse();

    expect(parsedData.responsibilities).toEqual([
      'First responsibility',
      'Second responsibility',
      'Third responsibility (using asterisk)',
    ]);
  });

  it('should correctly parse Future Features lists', () => {
    const sniperFileContent = `
## 🔮 Future Features

1. Feature A
2. Feature B
- Feature C (using hyphen)
`;
    const parser = new RoadmapParser(sniperFileContent);
    const parsedData = parser.parse();

    expect(parsedData.futureFeatures).toEqual([
      'Feature A',
      'Feature B',
      'Feature C (using hyphen)',
    ]);
  });

  it('should correctly parse the Integration Points table', () => {
    const sniperFileContent = `
## 🔌 Integration Points

| Linked Module | Purpose              | Status    |
| ------------- | -------------------- | --------- |
| Payment GW    | Process transactions | Confirmed |
| Email Service | Send notifications   | Pending   |
`;
    const parser = new RoadmapParser(sniperFileContent);
    const parsedData = parser.parse();

    expect(parsedData.integrationPoints).toEqual([
      { 'Linked Module': 'Payment GW', Purpose: 'Process transactions', Status: 'Confirmed' },
      { 'Linked Module': 'Email Service', Purpose: 'Send notifications', Status: 'Pending' },
    ]);
  });
});
