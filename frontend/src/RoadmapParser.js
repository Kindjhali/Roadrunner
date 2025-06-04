class RoadmapParser {
  constructor(roadmapContent) {
    this.roadmapContent = roadmapContent;
  }

  parse() {
    const lines = this.roadmapContent.split(/\r?\n/);
    const parsedData = {
      summary: '',
      metadata: {},
      responsibilities: [],
      integrationPoints: [],
      futureFeatures: [],
      // TODO: Add other sections like toko32Integration, keyDesignDecisions, etc.
    };

    let currentSection = null;
    let tableHeaders = [];

    const clearTable = () => {
      tableHeaders = [];
    };

    for (const line of lines) {
      const headingMatch = line.match(/^##\s+(.*)/);
      if (headingMatch) {
        currentSection = headingMatch[1].trim();
        clearTable();
        continue;
      }

      if (!currentSection || line.trim().length === 0) {
        continue;
      }

      switch (currentSection) {
        case '📌 Summary':
          parsedData.summary += (parsedData.summary ? ' ' : '') + line.trim();
          break;
        case '🧾 Metadata':
          if (line.startsWith('|')) {
            const cells = line.split('|').slice(1, -1).map(c => c.trim());
            if (cells.every(c => /^-+$/.test(c))) {
              break; // separator row
            }
            if (tableHeaders.length === 0) {
              tableHeaders = cells;
            } else if (tableHeaders.length >= 2) {
              const key = cells[0];
              const value = cells[1];
              if (key && value) {
                parsedData.metadata[key] = value;
              }
            }
          }
          break;
        case '🧠 Responsibilities':
          if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
            const item = line.replace(/^[-*]\s+|^\d+\.\s+/, '').trim();
            if (item) parsedData.responsibilities.push(item);
          }
          break;
        case '🔌 Integration Points':
          if (line.startsWith('|')) {
            const cells = line.split('|').slice(1, -1).map(c => c.trim());
            if (cells.every(c => /^-+$/.test(c))) {
              break; // separator row
            }
            if (tableHeaders.length === 0) {
              tableHeaders = cells;
            } else {
              const rowData = {};
              for (let i = 0; i < tableHeaders.length; i++) {
                rowData[tableHeaders[i]] = cells[i];
              }
              parsedData.integrationPoints.push(rowData);
            }
          }
          break;
        case '🔮 Future Features':
          if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
            const item = line.replace(/^[-*]\s+|^\d+\.\s+/, '').trim();
            if (item) parsedData.futureFeatures.push(item);
          }
          break;
        default:
          break;
      }
    }

    return parsedData;
  }
}

export default RoadmapParser;
