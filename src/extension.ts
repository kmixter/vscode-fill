// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { start } from 'repl';
import * as vscode from 'vscode';

function GetWordWrapColumn() {
	return vscode.workspace.getConfiguration('editor').get('rulers', [80])[0];
}

function GetFollowerPrefix(prefix: string): string {
	return prefix.replace(/\*/g, match => ' '.repeat(match[0].length));
}

function GetLinePrefix(line: string): [string, string] {
	const match = line.match(/^(\s*(\/\/|\*|#)?\s*)\S/);
	if (!match) {
		return ['', ''];
	}
	const prefix = match[1];
	const alternativePrefix = GetFollowerPrefix(prefix)

	return [prefix, GetFollowerPrefix(prefix)];
}

function couldStart(first: string, second: string): boolean {
	return first === second || GetFollowerPrefix(first) === second;
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
		const wordWrapColumn = GetWordWrapColumn();

		const currentCol = editor.selection.active.character;
		if (currentCol < wordWrapColumn) {
			return;
		}
		const currentLine = editor.selection.active.line;

		const lineText = document.lineAt(currentLine).text;

		const prefix = GetLinePrefix(lineText)[1]

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
		const currentLineText = textEditor.document.lineAt(currentLine).text;
		let [prefix, followerPrefix] = GetLinePrefix(currentLineText);
		let startPrefix = prefix;
		let regionText = currentLineText.substring(prefix.length);
		let startLine = currentLine;

		while (startLine > 0) {
			const prevText = textEditor.document.lineAt(startLine - 1).text;
			const prevPrefix = GetLinePrefix(prevText)[0];
			if (prevPrefix != prefix) {
				if (couldStart(prevPrefix, prefix)) {
					startPrefix = prevPrefix;
					--startLine;
				}
				break;
			}
			if (prevText.length == prefix.length) {
				break;
			}
			regionText = prevText.substring(prevPrefix.length) + '\n' + regionText;
			--startLine;
		}

		// Find the next blank line after the current line
		let endLine = currentLine;
		while (endLine < textEditor.document.lineCount - 1) {
			const nextText = textEditor.document.lineAt(endLine + 1).text;
			const nextPrefix = GetLinePrefix(nextText)[0];
			if (nextPrefix !== prefix && nextPrefix !== followerPrefix) {
				break;
			}
			if (nextText.length == prefix.length) {
				break;
			}
			regionText += '\n' + nextText.substring(nextPrefix.length);
			++endLine;
		}

		const wordWrapColumn = GetWordWrapColumn();
		followerPrefix = GetFollowerPrefix(startPrefix);

		// Word wrap the region text at 80 characters
		const wrappedText =
			regionText.split(/\s+/).reduce((acc, word) => {
				const lastLine = acc[acc.length - 1];
				if (lastLine.length + word.length + 1 > wordWrapColumn) {
					acc.push(followerPrefix + word);
				} else {
					let newLastLine = lastLine + ' ' + word;
					if (acc.length == 1 &&
							lastLine.length == startPrefix.length) {
						newLastLine = lastLine + word
					}
					acc[acc.length - 1] = newLastLine;
				}
				return acc;
			}, [startPrefix]).join('\n');

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
