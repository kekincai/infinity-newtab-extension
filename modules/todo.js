/**
 * Todo Module - Simple task management
 */

class TodoManager {
    constructor() {
        this.todos = [];
    }

    /**
     * Initialize todos
     */
    async init() {
        await this.loadTodos();
        return this.todos;
    }

    /**
     * Load todos from storage
     */
    async loadTodos() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['todos'], (result) => {
                this.todos = result.todos || [];
                resolve(this.todos);
            });
        });
    }

    /**
     * Save todos to storage
     */
    async saveTodos() {
        return new Promise((resolve) => {
            chrome.storage.sync.set({ todos: this.todos }, resolve);
        });
    }

    /**
     * Add a new todo
     */
    async addTodo(text) {
        const todo = {
            id: Date.now(),
            text,
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.todos.push(todo);
        await this.saveTodos();
        return todo;
    }

    /**
     * Toggle todo completion
     */
    async toggleTodo(id) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.completed = !todo.completed;
            await this.saveTodos();
        }
    }

    /**
     * Delete a todo
     */
    async deleteTodo(id) {
        this.todos = this.todos.filter(t => t.id !== id);
        await this.saveTodos();
    }

    /**
     * Update todo text
     */
    async updateTodo(id, text) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.text = text;
            await this.saveTodos();
        }
    }

    /**
     * Get all todos
     */
    getAllTodos() {
        return this.todos;
    }

    /**
     * Get active todos
     */
    getActiveTodos() {
        return this.todos.filter(t => !t.completed);
    }

    /**
     * Get completed todos
     */
    getCompletedTodos() {
        return this.todos.filter(t => t.completed);
    }

    /**
     * Clear completed todos
     */
    async clearCompleted() {
        this.todos = this.todos.filter(t => !t.completed);
        await this.saveTodos();
    }
}

// Export singleton instance
const todoManager = new TodoManager();
