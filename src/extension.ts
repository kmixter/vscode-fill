// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

function getWordWrapColumn() {
	return vscode.workspace.getConfiguration('editor').get('rulers', [80])[0];
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "vscode-fill" is now active!');

	// Register an event listener for the onDidChangeTextDocument event
	context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event) => {
		// Check if the document was modified
		if (event.contentChanges.length != 1) {
			return;
		}

		if (event.contentChanges[0].text != ' ') {
			return;
		}

		// Find the editor that matches the document in the event
		const document = event.document;
		const editor = vscode.window.visibleTextEditors.find(editor => editor.document === document);

		// Check if the current file is not plaintext, exit early
		if (document.languageId !== 'plaintext') {
			return;
		}

		if (!editor) {
			console.log('No editor found for the document');
			return;
		}

		// Retrieve the value of editor.ruler from the settings
		const wordWrapColumn = getWordWrapColumn();

		const currentCol = editor.selection.active.character;
		if (currentCol < wordWrapColumn) {
			return;
		}
		const currentLine = editor.selection.active.line;

		const lineText = document.lineAt(currentLine).text;

		// Check if the current line is a paragraph and capture the prefix
		const match = lineText.match(/^(\s*(\/\/|\*|#)?\s*)\S/);
		if (!match) {
			return;
		}
		const prefix = match[1];

		// Find the last space before currentCol on this line that's after the prefix
		const lastSpaceIndex = lineText.lastIndexOf(' ', currentCol - 1);
		if (lastSpaceIndex <= prefix.length) {
			return;
		}

		// Replace that space with \n followed by the prefix text again
		editor.edit(editBuilder => {
			editBuilder.replace(new vscode.Range(currentLine, lastSpaceIndex, currentLine, lastSpaceIndex + 1), '\n' + prefix);
		});
	}));

	// The command has been defined in the package.json file
	// The commandId parameter must match the command field in package.json
	context.subscriptions.push(vscode.commands.registerTextEditorCommand('vscode-fill.fill-paragraph', async (textEditor, edit) => {
		// Get the current line the cursor is on
		const cursorPosition = textEditor.selection.active;
		const currentLine = cursorPosition.line;

		// Find the last blank line before the current line
		let startLine = currentLine;
		while (startLine > 0 && textEditor.document.lineAt(startLine - 1).text.trim() !== '') {
			startLine--;
		}

		// Find the next blank line after the current line
		let endLine = currentLine;
		while (endLine < textEditor.document.lineCount - 1 &&
			   textEditor.document.lineAt(endLine + 1).text.trim() !== '') {
			endLine++;
		}

		// Get the text from the region between the blank lines
		let regionText = textEditor.document.getText(
			new vscode.Range(startLine, 0, endLine,
							 textEditor.document.lineAt(endLine).text.length));

		const wordWrapColumn = getWordWrapColumn();

		// Word wrap the region text at 80 characters
		const wrappedText = regionText.split(/\s+/).reduce((acc, word) => {
			const lastLine = acc[acc.length - 1];
			if (lastLine.length + word.length + 1 > wordWrapColumn) {
				acc.push(word);
			} else {
				acc[acc.length - 1] = lastLine + ' ' + word;
			}
			return acc;
		}, ['']).join('\n').trim();

		// Replace the region with the wrapped text
		await textEditor.edit(editBuilder => {
			editBuilder.replace(
				new vscode.Range(
					startLine, 0,
					endLine, textEditor.document.lineAt(endLine).text.length),
				wrappedText);
		});
}));
}

// This method is called when your extension is deactivated
export function deactivate() {}
