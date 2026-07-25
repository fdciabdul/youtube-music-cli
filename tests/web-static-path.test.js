import test from 'ava';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {resolveWebDistDir} from '../source/services/web/static-file.service.ts';

function makeTempRoot() {
	return mkdtempSync(join(tmpdir(), 'ymc-web-static-'));
}

test('resolveWebDistDir prefers bundled CLI sibling dist/web', t => {
	const root = makeTempRoot();
	t.teardown(() => rmSync(root, {recursive: true, force: true}));

	const sourceDir = join(root, 'dist', 'source');
	const webDir = join(root, 'dist', 'web');
	mkdirSync(sourceDir, {recursive: true});
	mkdirSync(webDir, {recursive: true});
	writeFileSync(join(webDir, 'index.html'), '<html></html>');

	const moduleUrl = pathToFileURL(join(sourceDir, 'cli.js')).href;
	const resolved = resolveWebDistDir(moduleUrl, root, join(root, 'fake-exe'));

	t.is(resolved, webDir);
});

test('resolveWebDistDir finds projectRoot/dist/web from source/services/web', t => {
	const root = makeTempRoot();
	t.teardown(() => rmSync(root, {recursive: true, force: true}));

	const serviceDir = join(root, 'source', 'services', 'web');
	const webDir = join(root, 'dist', 'web');
	mkdirSync(serviceDir, {recursive: true});
	mkdirSync(webDir, {recursive: true});
	writeFileSync(join(webDir, 'index.html'), '<html></html>');

	const moduleUrl = pathToFileURL(
		join(serviceDir, 'static-file.service.ts'),
	).href;
	const resolved = resolveWebDistDir(
		moduleUrl,
		join(root, 'other'),
		join(root, 'fake-exe'),
	);

	t.is(resolved, webDir);
});

test('resolveWebDistDir falls back to cwd dist/web', t => {
	const root = makeTempRoot();
	t.teardown(() => rmSync(root, {recursive: true, force: true}));

	const moduleDir = join(root, 'somewhere', 'else');
	const webDir = join(root, 'dist', 'web');
	mkdirSync(moduleDir, {recursive: true});
	mkdirSync(webDir, {recursive: true});
	writeFileSync(join(webDir, 'index.html'), '<html></html>');

	const moduleUrl = pathToFileURL(join(moduleDir, 'cli.js')).href;
	const resolved = resolveWebDistDir(
		moduleUrl,
		root,
		join(root, 'no-web', 'exe'),
	);

	t.is(resolved, webDir);
});

test('resolveWebDistDir uses exe sibling web when present', t => {
	const root = makeTempRoot();
	t.teardown(() => rmSync(root, {recursive: true, force: true}));

	const moduleDir = join(root, 'somewhere');
	const exeDir = join(root, 'bin');
	const webDir = join(exeDir, 'web');
	mkdirSync(moduleDir, {recursive: true});
	mkdirSync(webDir, {recursive: true});
	writeFileSync(join(webDir, 'index.html'), '<html></html>');

	const moduleUrl = pathToFileURL(join(moduleDir, 'cli.js')).href;
	const resolved = resolveWebDistDir(
		moduleUrl,
		join(root, 'empty-cwd'),
		join(exeDir, 'ymc.exe'),
	);

	t.is(resolved, webDir);
});

test('resolveWebDistDir returns first candidate when nothing is built', t => {
	const root = makeTempRoot();
	t.teardown(() => rmSync(root, {recursive: true, force: true}));

	const sourceDir = join(root, 'dist', 'source');
	mkdirSync(sourceDir, {recursive: true});

	const moduleUrl = pathToFileURL(join(sourceDir, 'cli.js')).href;
	const resolved = resolveWebDistDir(moduleUrl, root, join(root, 'fake-exe'));

	t.is(resolved, join(root, 'dist', 'web'));
});
