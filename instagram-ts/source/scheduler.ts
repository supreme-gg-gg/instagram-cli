import fs from 'fs/promises';
import path from 'path';
import { ConfigManager } from './config.js';

export interface ScheduledTask {
	threadId: string;
	sendTime: string;
	message: string;
	displayName?: string;
}

export class Scheduler {
	private static instance: Scheduler;
	private taskFile: string;
	private tasks: ScheduledTask[] = [];

	private constructor() {
		const config = ConfigManager.getInstance();
		const usersDir = config.get<string>('advanced.usersDir');
		const username = config.get<string>('login.currentUsername');
		if (!username) {
			throw new Error('No current user found in config');
		}
		this.taskFile = path.join(usersDir, username, 'tasks.json');
	}

	public static getInstance(): Scheduler {
		if (!Scheduler.instance) {
			Scheduler.instance = new Scheduler();
		}
		return Scheduler.instance;
	}

	public async initialize(): Promise<void> {
		await this.loadTasks();
	}

	private async loadTasks(): Promise<void> {
		try {
			await fs.mkdir(path.dirname(this.taskFile), {recursive: true});
			const tasksExist = await fs
				.access(this.taskFile)
				.then(() => true)
				.catch(() => false);

			if (tasksExist) {
				const taskData = await fs.readFile(this.taskFile, 'utf8');
				this.tasks = JSON.parse(taskData) as ScheduledTask[];
			} else {
				await this.saveTasks();
			}
		} catch (error) {
			console.error('Error loading tasks:', error);
			this.tasks = [];
		}
	}

	private async saveTasks(): Promise<void> {
		try {
			await fs.writeFile(this.taskFile, JSON.stringify(this.tasks, null, 2), 'utf8');
		} catch (error) {
			console.error('Error saving tasks:', error);
		}
	}

	public async addTask(task: ScheduledTask): Promise<void> {
		this.tasks.push(task);
		await this.saveTasks();
	}

	public async listTasks(): Promise<ScheduledTask[]> {
		return this.tasks;
	}

	public async cancelTask(index: number): Promise<boolean> {
		if (index < 0 || index >= this.tasks.length) {
			return false;
		}
		this.tasks.splice(index, 1);
		await this.saveTasks();
		return true;
	}
}
