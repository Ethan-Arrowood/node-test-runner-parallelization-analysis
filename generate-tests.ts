import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const NUM_TEST_FILES = 20;
const START_PORT = 3000;

const outputDir = join(import.meta.dirname, `test-files`);
if (!existsSync(outputDir)) {
	mkdirSync(outputDir, { recursive: true });
}

const templatePath = join(import.meta.dirname, 'test.template.ts');
const template = readFileSync(templatePath, 'utf8');

console.log(`Generating ${NUM_TEST_FILES} test files...`);
const testFiles: string[] = [];

for (let i = 0; i < NUM_TEST_FILES; i++) {
	const testNumber = i;
	const port = START_PORT + i;
	const fileName = `${i}.test.ts`;
	const filePath = join(outputDir, fileName);

	const content = template
		.replaceAll('__TEST_NUMBER__', testNumber.toString())
		.replaceAll('__PORT__', port.toString());

	writeFileSync(filePath, content);
	testFiles.push(filePath);
}
console.log(`✓ Generated ${NUM_TEST_FILES} test files\n`);