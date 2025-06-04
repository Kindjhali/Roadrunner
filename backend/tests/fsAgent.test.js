const fs = require('fs');
const path = require('path');
const os = require('os');
const { ModularFsAgent } = require('../fsAgent'); // Adjust path as necessary

describe('ModularFsAgent', () => {
    let testWorkspaceDir;
    let fsAgentInstance;
    let mockLogger;

    beforeEach(() => {
        // Create a unique temporary directory for each test
        testWorkspaceDir = path.join(os.tmpdir(), `rr_fs_agent_test_${Date.now()}_${Math.random().toString(36).substring(2,7)}`);
        fs.mkdirSync(testWorkspaceDir, { recursive: true });

        mockLogger = {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        fsAgentInstance = new ModularFsAgent({
            workspaceDir: testWorkspaceDir,
            logger: mockLogger,
            allowedExternalPaths: [], // Keep empty for most tests, or add specific test paths
        });
    });

    afterEach(() => {
        // Clean up the temporary directory
        if (fs.existsSync(testWorkspaceDir)) {
            fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
        }
    });

    describe('resolvePathInWorkspace', () => {
        it('should resolve a valid path within the workspace', () => {
            const result = fsAgentInstance.resolvePathInWorkspace('test.txt');
            expect(result.success).toBe(true);
            expect(result.fullPath).toBe(path.join(testWorkspaceDir, 'test.txt'));
        });

        it('should return error for path traversal attempts', () => {
            const result = fsAgentInstance.resolvePathInWorkspace('../outside.txt');
            expect(result.success).toBe(false);
            expect(result.error.code).toBe('FS_RESOLVE_PATH_TRAVERSAL_ATTEMPT');
        });

        it('should return error for paths outside allowed roots', () => {
            // Test with an absolute path outside the workspace
            const outsideAbsolutePath = path.resolve(os.tmpdir(), 'some_other_external_file.txt');
            const result = fsAgentInstance.resolvePathInWorkspace(outsideAbsolutePath);
            expect(result.success).toBe(false);
            expect(result.error.code).toBe('FS_RESOLVE_PATH_OUTSIDE_ROOTS');
        });

        it('should allow paths in allowedExternalPaths', () => {
            const externalDir = path.join(os.tmpdir(), `rr_external_${Date.now()}`);
            fs.mkdirSync(externalDir, { recursive: true });
            const agentWithExternal = new ModularFsAgent({
                workspaceDir: testWorkspaceDir,
                logger: mockLogger,
                allowedExternalPaths: [externalDir],
            });
            const result = agentWithExternal.resolvePathInWorkspace(path.join(externalDir, 'external.txt'));
            expect(result.success).toBe(true);
            expect(result.fullPath).toBe(path.join(externalDir, 'external.txt'));
            fs.rmSync(externalDir, { recursive: true, force: true });
        });

        it('should return error for invalid path type', () => {
            const result = fsAgentInstance.resolvePathInWorkspace(123);
            expect(result.success).toBe(false);
            expect(result.error.code).toBe('FS_RESOLVE_PATH_INVALID_TYPE');
        });
    });

    describe('createFile', () => {
        it('should create a file successfully', () => {
            const result = fsAgentInstance.createFile('newfile.txt', 'Hello world');
            expect(result.success).toBe(true);
            expect(result.message).toContain('File created/overwritten successfully');
            expect(fs.existsSync(path.join(testWorkspaceDir, 'newfile.txt'))).toBe(true);
            expect(fs.readFileSync(path.join(testWorkspaceDir, 'newfile.txt'), 'utf8')).toBe('Hello world');
        });

        it('should create parent directories if they do not exist', () => {
            const result = fsAgentInstance.createFile('new/nested/dir/deepfile.txt', 'Deep content');
            expect(result.success).toBe(true);
            expect(fs.existsSync(path.join(testWorkspaceDir, 'new/nested/dir/deepfile.txt'))).toBe(true);
        });

        it('should return confirmationNeeded when overwriting if requireConfirmation is true', () => {
            fsAgentInstance.createFile('existing.txt', 'Initial content');
            const result = fsAgentInstance.createFile('existing.txt', 'New content', { requireConfirmation: true, isConfirmedAction: false });
            expect(result.success).toBe(false);
            expect(result.confirmationNeeded).toBe(true);
            expect(result.error.code).toBe('FS_CONFIRMATION_REQUIRED');
            expect(fs.readFileSync(path.join(testWorkspaceDir, 'existing.txt'), 'utf8')).toBe('Initial content'); // Not overwritten
        });

        it('should overwrite if requireConfirmation is true and isConfirmedAction is true', () => {
            fsAgentInstance.createFile('existing.txt', 'Initial content');
            const result = fsAgentInstance.createFile('existing.txt', 'New content', { requireConfirmation: true, isConfirmedAction: true });
            expect(result.success).toBe(true);
            expect(fs.readFileSync(path.join(testWorkspaceDir, 'existing.txt'), 'utf8')).toBe('New content');
            expect(fs.existsSync(path.join(testWorkspaceDir, 'existing.txt.bak'))).toBe(true); // Backup created
        });

        it('should overwrite if requireConfirmation is false', () => {
            fsAgentInstance.createFile('existing.txt', 'Initial content');
            const result = fsAgentInstance.createFile('existing.txt', 'New content', { requireConfirmation: false });
            expect(result.success).toBe(true);
            expect(fs.readFileSync(path.join(testWorkspaceDir, 'existing.txt'), 'utf8')).toBe('New content');
            // Backup should also be created by default if overwriting an existing file
            expect(fs.existsSync(path.join(testWorkspaceDir, 'existing.txt.bak'))).toBe(true);
        });

        it('should return error for invalid path', () => {
            const result = fsAgentInstance.createFile('../outside_workspace/file.txt', 'content');
            expect(result.success).toBe(false);
            expect(result.error.code).toBe('FS_RESOLVE_PATH_OUTSIDE_ROOTS');
        });
    });

    describe('readFile', () => {
        it('should read an existing file', () => {
            const filePath = 'readable.txt';
            const content = 'Readable content';
            fs.writeFileSync(path.join(testWorkspaceDir, filePath), content);
            const result = fsAgentInstance.readFile(filePath);
            expect(result.success).toBe(true);
            expect(result.content).toBe(content);
        });

        it('should return error if file not found', () => {
            const result = fsAgentInstance.readFile('nonexistent.txt');
            expect(result.success).toBe(false);
            expect(result.error.code).toBe('FS_READ_FILE_NOT_FOUND');
        });
    });

    describe('updateFile', () => {
        beforeEach(() => {
            fsAgentInstance.createFile('update_me.txt', 'Initial content for update.');
        });

        it('should update existing file (overwrite)', () => {
            const result = fsAgentInstance.updateFile('update_me.txt', 'Updated content.');
            expect(result.success).toBe(true);
            expect(fs.readFileSync(path.join(testWorkspaceDir, 'update_me.txt'), 'utf8')).toBe('Updated content.');
            expect(fs.existsSync(path.join(testWorkspaceDir, 'update_me.txt.bak'))).toBe(true);
        });

        it('should append to existing file', () => {
            const result = fsAgentInstance.updateFile('update_me.txt', ' Appended.', { append: true });
            expect(result.success).toBe(true);
            expect(fs.readFileSync(path.join(testWorkspaceDir, 'update_me.txt'), 'utf8')).toBe('Initial content for update. Appended.');
        });

        it('should create file if it does not exist and not appending', () => {
            const result = fsAgentInstance.updateFile('new_for_update.txt', 'Newly created by update.');
            expect(result.success).toBe(true);
            expect(fs.existsSync(path.join(testWorkspaceDir, 'new_for_update.txt'))).toBe(true);
            expect(fs.readFileSync(path.join(testWorkspaceDir, 'new_for_update.txt'), 'utf8')).toBe('Newly created by update.');
        });

        it('should return error if trying to append to a non-existent file', () => {
            const result = fsAgentInstance.updateFile('non_existent_for_append.txt', 'Content', { append: true });
            expect(result.success).toBe(false);
            expect(result.error.code).toBe('FS_UPDATE_APPEND_NON_EXISTENT');
        });

        it('should require confirmation for overwrite if specified', () => {
            const result = fsAgentInstance.updateFile('update_me.txt', 'New content', { requireConfirmation: true, isConfirmedAction: false });
            expect(result.success).toBe(false);
            expect(result.confirmationNeeded).toBe(true);
            expect(result.error.code).toBe('FS_CONFIRMATION_REQUIRED');
        });
    });

    describe('deleteFile', () => {
        beforeEach(() => {
            fsAgentInstance.createFile('delete_me.txt', 'Content to be deleted.');
        });

        it('should delete an existing file', () => {
            const result = fsAgentInstance.deleteFile('delete_me.txt', { isConfirmedAction: true }); // Assume confirmed
            expect(result.success).toBe(true);
            expect(fs.existsSync(path.join(testWorkspaceDir, 'delete_me.txt'))).toBe(false);
            expect(fs.existsSync(path.join(testWorkspaceDir, 'delete_me.txt.bak'))).toBe(true);
        });

        it('should return error if file not found', () => {
            const result = fsAgentInstance.deleteFile('nonexistent_to_delete.txt');
            expect(result.success).toBe(false);
            expect(result.error.code).toBe('FS_DELETE_FILE_NOT_FOUND');
        });

        it('should require confirmation if specified', () => {
            const result = fsAgentInstance.deleteFile('delete_me.txt', { requireConfirmation: true, isConfirmedAction: false });
            expect(result.success).toBe(false);
            expect(result.confirmationNeeded).toBe(true);
            expect(result.error.code).toBe('FS_CONFIRMATION_REQUIRED');
            expect(fs.existsSync(path.join(testWorkspaceDir, 'delete_me.txt'))).toBe(true); // Still exists
        });
    });

    describe('checkFileExists', () => {
        it('should return true if file exists', () => {
            fsAgentInstance.createFile('i_exist.txt', 'content');
            const result = fsAgentInstance.checkFileExists('i_exist.txt');
            expect(result.success).toBe(true);
            expect(result.exists).toBe(true);
        });

        it('should return false if file does not exist', () => {
            const result = fsAgentInstance.checkFileExists('i_do_not_exist.txt');
            expect(result.success).toBe(true); // Operation itself is successful
            expect(result.exists).toBe(false);
        });
    });

    describe('createDirectory', () => {
        it('should create a directory successfully', () => {
            const result = fsAgentInstance.createDirectory('new_dir');
            expect(result.success).toBe(true);
            expect(fs.existsSync(path.join(testWorkspaceDir, 'new_dir'))).toBe(true);
            expect(fs.statSync(path.join(testWorkspaceDir, 'new_dir')).isDirectory()).toBe(true);
        });

        it('should succeed if directory already exists', () => {
            fs.mkdirSync(path.join(testWorkspaceDir, 'existing_dir'));
            const result = fsAgentInstance.createDirectory('existing_dir');
            expect(result.success).toBe(true);
        });

        it('should handle nested directory creation', () => {
            const result = fsAgentInstance.createDirectory('parent/child/grandchild');
            expect(result.success).toBe(true);
            expect(fs.existsSync(path.join(testWorkspaceDir, 'parent/child/grandchild'))).toBe(true);
        });
    });

    describe('deleteDirectory', () => {
        beforeEach(() => {
            fs.mkdirSync(path.join(testWorkspaceDir, 'dir_to_delete'), { recursive: true });
            fs.writeFileSync(path.join(testWorkspaceDir, 'dir_to_delete/file.txt'), 'content');
            fs.mkdirSync(path.join(testWorkspaceDir, 'dir_to_delete/subdir'), { recursive: true });
        });

        it('should delete an existing directory and its contents', () => {
            const result = fsAgentInstance.deleteDirectory('dir_to_delete', { isConfirmedAction: true });
            expect(result.success).toBe(true);
            expect(fs.existsSync(path.join(testWorkspaceDir, 'dir_to_delete'))).toBe(false);
        });

        it('should return error if directory not found', () => {
            const result = fsAgentInstance.deleteDirectory('non_existent_dir_to_delete');
            expect(result.success).toBe(false);
            expect(result.error.code).toBe('FS_DELETE_DIR_NOT_FOUND');
        });

        it('should require confirmation if specified', () => {
            const result = fsAgentInstance.deleteDirectory('dir_to_delete', { requireConfirmation: true, isConfirmedAction: false });
            expect(result.success).toBe(false);
            expect(result.confirmationNeeded).toBe(true);
            expect(result.error.code).toBe('FS_CONFIRMATION_REQUIRED');
            expect(fs.existsSync(path.join(testWorkspaceDir, 'dir_to_delete'))).toBe(true); // Still exists
        });
    });

    describe('generateDirectoryTree', () => {
        beforeEach(() => {
            fs.mkdirSync(path.join(testWorkspaceDir, 'tree_root'), { recursive: true });
            fs.writeFileSync(path.join(testWorkspaceDir, 'tree_root/file1.txt'), 'content1');
            fs.mkdirSync(path.join(testWorkspaceDir, 'tree_root/subdir1'), { recursive: true });
            fs.writeFileSync(path.join(testWorkspaceDir, 'tree_root/subdir1/file2.txt'), 'content2');
            fs.mkdirSync(path.join(testWorkspaceDir, 'tree_root/empty_subdir'), { recursive: true });
        });

        it('should generate a correct directory tree string', () => {
            const tree = fsAgentInstance.generateDirectoryTree('tree_root');
            // This is a basic check; more sophisticated snapshot testing could be used.
            expect(tree).toContain('tree_root');
            expect(tree).toContain('file1.txt');
            expect(tree).toContain('subdir1');
            expect(tree).toContain('file2.txt');
            expect(tree).toContain('empty_subdir');
            // Check for tree structure elements
            expect(tree).toMatch(/├── |\n└── /);
        });

        it('should return error string for non-existent path', () => {
            const tree = fsAgentInstance.generateDirectoryTree('non_existent_root');
            expect(tree).toMatch(/^Error: Path .* not found or inaccessible/);
        });

        it('should return error string if path is not a directory', () => {
            fsAgentInstance.createFile('not_a_dir.txt', '');
            const tree = fsAgentInstance.generateDirectoryTree('not_a_dir.txt');
            expect(tree).toMatch(/^Error: Path .* is not a directory/);
        });
    });
});
