const path = require('path');
const { ModularGitAgent } = require('../gitAgent'); // Adjust path as necessary

// Mock simple-git
let mockSimpleGitInstance = {
    add: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue({ commit: 'test-sha', summary: { changes: 1, insertions: 1, deletions: 0 } }),
    push: jest.fn().mockResolvedValue(undefined),
    pull: jest.fn().mockResolvedValue({ summary: { changes: 1, insertions: 1, deletions: 0 }, files: ['file.txt'] }),
    revert: jest.fn().mockResolvedValue(undefined),
    status: jest.fn().mockResolvedValue({ staged: ['test.txt'] }),
    log: jest.fn().mockResolvedValue({ latest: { hash: 'new-sha', message: 'Reverted commit' } }),
};
jest.mock('simple-git', () => {
    return jest.fn(() => mockSimpleGitInstance);
});

describe('ModularGitAgent', () => {
    let gitAgentInstance;
    let mockLogger;
    const testWorkDir = path.resolve(__dirname, 'temp_git_repo'); // A dummy path, actual git ops are mocked

    beforeEach(() => {
        // Reset mocks for each test
        jest.clearAllMocks(); // Clears all mocks, including simple-git constructor and its methods

        // Re-initialize the mock instance if specific methods were changed by a test
         mockSimpleGitInstance = {
            add: jest.fn().mockResolvedValue(undefined),
            commit: jest.fn().mockResolvedValue({ commit: 'test-sha', summary: { changes: 1, insertions: 1, deletions: 0 } }),
            push: jest.fn().mockResolvedValue(undefined),
            pull: jest.fn().mockResolvedValue({ summary: { changes: 1, insertions: 1, deletions: 0 }, files: ['file.txt'] }),
            revert: jest.fn().mockResolvedValue(undefined),
            status: jest.fn().mockResolvedValue({ staged: ['test.txt'] }),
            log: jest.fn().mockResolvedValue({ latest: { hash: 'new-sha', message: 'Reverted commit' } }),
        };

        mockLogger = {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        gitAgentInstance = new ModularGitAgent({
            workDir: testWorkDir, // Mocked, so dir doesn't need to exist
            logger: mockLogger,
        });
    });

    describe('gitAdd', () => {
        it('should call git.add and git.status on success', async () => {
            const result = await gitAgentInstance.gitAdd('test.txt');
            expect(result.success).toBe(true);
            expect(mockSimpleGitInstance.add).toHaveBeenCalledWith('test.txt');
            expect(mockSimpleGitInstance.status).toHaveBeenCalled();
            expect(result.stagedFiles).toEqual(['test.txt']);
        });

        it('should return a structured error on failure', async () => {
            const mockError = new Error('Git add failed');
            mockSimpleGitInstance.add.mockRejectedValue(mockError);
            const result = await gitAgentInstance.gitAdd('error.txt');
            expect(result.success).toBe(false);
            expect(result.error.code).toBe('GIT_ADD_FAILED');
            expect(result.error.message).toContain('Failed to stage \'error.txt\'');
            expect(result.error.details.originalError).toBe(mockError);
        });
    });

    describe('gitCommit', () => {
        const commitMessage = 'Test commit';
        it('should call git.commit on success', async () => {
            const result = await gitAgentInstance.gitCommit(commitMessage);
            expect(result.success).toBe(true);
            expect(mockSimpleGitInstance.commit).toHaveBeenCalledWith(commitMessage);
            expect(result.commitSummary).toBeDefined();
        });

        it('should return confirmationNeeded if options require it and not confirmed', async () => {
            const result = await gitAgentInstance.gitCommit(commitMessage, { requireConfirmation: true, isConfirmedAction: false });
            expect(result.success).toBe(false);
            expect(result.confirmationNeeded).toBe(true);
            expect(result.error.code).toBe('GIT_CONFIRMATION_REQUIRED');
            expect(mockSimpleGitInstance.commit).not.toHaveBeenCalled();
        });

        it('should proceed if options require confirmation and isConfirmedAction is true', async () => {
            await gitAgentInstance.gitCommit(commitMessage, { requireConfirmation: true, isConfirmedAction: true });
            expect(mockSimpleGitInstance.commit).toHaveBeenCalledWith(commitMessage);
        });

        it('should return a structured error on failure', async () => {
            const mockError = new Error('Git commit failed');
            mockSimpleGitInstance.commit.mockRejectedValue(mockError);
            const result = await gitAgentInstance.gitCommit('fail commit');
            expect(result.success).toBe(false);
            expect(result.error.code).toBe('GIT_COMMIT_FAILED');
            expect(result.error.message).toContain('Failed to commit');
            expect(result.error.details.originalError).toBe(mockError);
        });
    });

    describe('gitPush', () => {
        const remote = 'origin';
        const branch = 'main';
        it('should call git.push on success', async () => {
            const result = await gitAgentInstance.gitPush(remote, branch);
            expect(result.success).toBe(true);
            expect(mockSimpleGitInstance.push).toHaveBeenCalledWith(remote, branch);
        });

        it('should return confirmationNeeded for push', async () => {
            const result = await gitAgentInstance.gitPush(remote, branch, { requireConfirmation: true, isConfirmedAction: false });
            expect(result.success).toBe(false);
            expect(result.confirmationNeeded).toBe(true);
            expect(result.error.code).toBe('GIT_CONFIRMATION_REQUIRED');
            expect(mockSimpleGitInstance.push).not.toHaveBeenCalled();
        });

        it('should proceed with push if confirmed', async () => {
            await gitAgentInstance.gitPush(remote, branch, { requireConfirmation: true, isConfirmedAction: true });
            expect(mockSimpleGitInstance.push).toHaveBeenCalledWith(remote, branch);
        });

        it('should return structured error on push failure', async () => {
            const mockError = new Error('Git push failed');
            mockSimpleGitInstance.push.mockRejectedValue(mockError);
            const result = await gitAgentInstance.gitPush(remote, branch);
            expect(result.success).toBe(false);
            expect(result.error.code).toBe('GIT_PUSH_FAILED');
            expect(result.error.details.originalError).toBe(mockError);
        });
    });

    describe('gitPull', () => {
        const remote = 'origin';
        const branch = 'main';
        it('should call git.pull on success', async () => {
            const result = await gitAgentInstance.gitPull(remote, branch);
            expect(result.success).toBe(true);
            expect(mockSimpleGitInstance.pull).toHaveBeenCalledWith(remote, branch);
            expect(result.pullSummary).toBeDefined();
        });

        it('should return structured error on pull failure', async () => {
            const mockError = new Error('Git pull failed');
            mockSimpleGitInstance.pull.mockRejectedValue(mockError);
            const result = await gitAgentInstance.gitPull(remote, branch);
            expect(result.success).toBe(false);
            expect(result.error.code).toBe('GIT_PULL_FAILED');
            expect(result.error.details.originalError).toBe(mockError);
        });
    });

    describe('gitRevertLastCommit', () => {
        it('should call git.revert and git.log on success', async () => {
            const result = await gitAgentInstance.gitRevertLastCommit();
            expect(result.success).toBe(true);
            expect(mockSimpleGitInstance.revert).toHaveBeenCalledWith('HEAD', { '--no-edit': null });
            expect(mockSimpleGitInstance.log).toHaveBeenCalledWith(['-1']);
            expect(result.revertSummary).toBeDefined();
        });

        it('should return confirmationNeeded for revert', async () => {
            const result = await gitAgentInstance.gitRevertLastCommit({ requireConfirmation: true, isConfirmedAction: false });
            expect(result.success).toBe(false);
            expect(result.confirmationNeeded).toBe(true);
            expect(result.error.code).toBe('GIT_CONFIRMATION_REQUIRED');
            expect(mockSimpleGitInstance.revert).not.toHaveBeenCalled();
        });

        it('should proceed with revert if confirmed', async () => {
            await gitAgentInstance.gitRevertLastCommit({ requireConfirmation: true, isConfirmedAction: true });
            expect(mockSimpleGitInstance.revert).toHaveBeenCalledWith('HEAD', { '--no-edit': null });
        });

        it('should return structured error on revert failure', async () => {
            const mockError = new Error('Git revert failed');
            mockSimpleGitInstance.revert.mockRejectedValue(mockError);
            const result = await gitAgentInstance.gitRevertLastCommit();
            expect(result.success).toBe(false);
            expect(result.error.code).toBe('GIT_REVERT_FAILED');
            expect(result.error.details.originalError).toBe(mockError);
        });
    });
});
