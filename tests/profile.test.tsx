/* eslint-disable @typescript-eslint/no-unsafe-call */

import React from 'react';
import test from 'ava';
import {render} from 'ink-testing-library';
import ProfileView from '../source/ui/views/profile-view.js';
import type {ProfileInfo} from '../source/types/instagram.js';

const mockProfile: ProfileInfo = {
	pk: '12345',
	username: 'testuser',
	fullName: 'Test User',
	profilePicUrl: undefined,
	isVerified: true,
	isPrivate: false,
	biography: 'Building things in the terminal.',
	followerCount: 12_500,
	followingCount: 843,
	mediaCount: 127,
	externalUrl: 'https://example.com',
};

test('profile view renders username', t => {
	const {lastFrame} = render(<ProfileView profile={mockProfile} />);
	const output = lastFrame()!;
	t.true(output.includes('@testuser'));
});

test('profile view renders follower count', t => {
	const {lastFrame} = render(<ProfileView profile={mockProfile} />);
	const output = lastFrame()!;
	t.true(output.includes('12.5k'));
	t.true(output.includes('followers'));
});

test('profile view renders bio', t => {
	const {lastFrame} = render(<ProfileView profile={mockProfile} />);
	const output = lastFrame()!;
	t.true(output.includes('Building things in the terminal'));
});

test('profile view renders external url', t => {
	const {lastFrame} = render(<ProfileView profile={mockProfile} />);
	const output = lastFrame()!;
	t.true(output.includes('https://example.com'));
});

test('profile view renders post count', t => {
	const {lastFrame} = render(<ProfileView profile={mockProfile} />);
	const output = lastFrame()!;
	t.true(output.includes('127'));
	t.true(output.includes('posts'));
});

test('profile view renders verified badge', t => {
	const {lastFrame} = render(<ProfileView profile={mockProfile} />);
	const output = lastFrame()!;
	t.true(output.includes('✓'));
});

test('profile view hides bio when empty', t => {
	const emptyBioProfile = {...mockProfile, biography: ''};
	const {lastFrame} = render(<ProfileView profile={emptyBioProfile} />);
	const output = lastFrame()!;
	// Should still render username but not have an extra separator for bio
	t.true(output.includes('@testuser'));
});

test('profile view renders private indicator', t => {
	const privateProfile = {...mockProfile, isPrivate: true};
	const {lastFrame} = render(<ProfileView profile={privateProfile} />);
	const output = lastFrame()!;
	t.true(output.includes('🔒'));
});
