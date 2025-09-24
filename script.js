// Smart Study Planner JavaScript

class StudyPlanner {
    constructor() {
        this.tasks = this.loadTasks();
        this.currentTab = 'dashboard';
        this.currentDate = new Date();
        this.editingTaskId = null;
        this.studyGoal = this.loadStudyGoal();
        this.achievements = this.loadAchievements();
        this.activityLog = this.loadActivityLog();
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderDashboard();
        this.renderTasks();
        this.renderCalendar();
        this.renderGoals();
        this.updateStats();
        this.checkReminders();
        
        // Check reminders every minute
        setInterval(() => this.checkReminders(), 60000);
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Task management
        document.getElementById('addTaskBtn').addEventListener('click', () => this.openTaskModal());
        document.getElementById('taskForm').addEventListener('submit', (e) => this.handleTaskSubmit(e));
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeTaskModal());
        document.querySelector('.close-modal').addEventListener('click', () => this.closeTaskModal());

        // Search and filters
        document.getElementById('searchTasks').addEventListener('input', (e) => this.filterTasks());
        document.getElementById('filterSubject').addEventListener('change', () => this.filterTasks());
        document.getElementById('filterPriority').addEventListener('change', () => this.filterTasks());
        document.getElementById('filterStatus').addEventListener('change', () => this.filterTasks());

        // Calendar navigation
        document.getElementById('prevMonth').addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('nextMonth').addEventListener('click', () => this.changeMonth(1));

        // Goals
        document.getElementById('setGoalBtn').addEventListener('click', () => this.setStudyGoal());

        // Modal click outside to close
        document.getElementById('taskModal').addEventListener('click', (e) => {
            if (e.target.id === 'taskModal') {
                this.closeTaskModal();
            }
        });

        // Notification permission
        if ('Notification' in window) {
            Notification.requestPermission();
        }
    }

    // Data Management
    loadTasks() {
        const tasks = localStorage.getItem('studyPlannerTasks');
        return tasks ? JSON.parse(tasks) : [];
    }

    saveTasks() {
        localStorage.setItem('studyPlannerTasks', JSON.stringify(this.tasks));
        this.updateStats();
        this.renderDashboard();
        this.renderTasks();
        this.renderCalendar();
    }

    loadStudyGoal() {
        const goal = localStorage.getItem('studyPlannerGoal');
        return goal ? JSON.parse(goal) : { weeklyHours: 20, currentHours: 0, weekStart: this.getWeekStart() };
    }

    saveStudyGoal() {
        localStorage.setItem('studyPlannerGoal', JSON.stringify(this.studyGoal));
        this.renderGoals();
    }

    loadAchievements() {
        const achievements = localStorage.getItem('studyPlannerAchievements');
        return achievements ? JSON.parse(achievements) : {
            firstTask: false,
            studyStreak: false,
            goalAchiever: false
        };
    }

    saveAchievements() {
        localStorage.setItem('studyPlannerAchievements', JSON.stringify(this.achievements));
    }

    loadActivityLog() {
        const log = localStorage.getItem('studyPlannerActivity');
        return log ? JSON.parse(log) : [];
    }

    saveActivityLog() {
        // Keep only last 20 activities
        if (this.activityLog.length > 20) {
            this.activityLog = this.activityLog.slice(-20);
        }
        localStorage.setItem('studyPlannerActivity', JSON.stringify(this.activityLog));
        this.renderDashboard();
    }

    // Tab Management
    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(tabName).classList.add('active');

        this.currentTab = tabName;

        // Render content based on tab
        if (tabName === 'dashboard') {
            this.renderDashboard();
        } else if (tabName === 'calendar') {
            this.renderCalendar();
        } else if (tabName === 'goals') {
            this.renderGoals();
        }
    }

    // Task Management
    openTaskModal(taskId = null) {
        const modal = document.getElementById('taskModal');
        const title = document.getElementById('modalTitle');
        const form = document.getElementById('taskForm');
        
        this.editingTaskId = taskId;
        
        if (taskId) {
            const task = this.tasks.find(t => t.id === taskId);
            title.textContent = 'Edit Task';
            this.populateTaskForm(task);
        } else {
            title.textContent = 'Add New Task';
            form.reset();
            // Set default due date to tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            document.getElementById('taskDueDate').value = tomorrow.toISOString().split('T')[0];
        }
        
        modal.classList.add('active');
    }

    closeTaskModal() {
        document.getElementById('taskModal').classList.remove('active');
        this.editingTaskId = null;
    }

    populateTaskForm(task) {
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description;
        document.getElementById('taskSubject').value = task.subject;
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskDueDate').value = task.dueDate;
        document.getElementById('taskEstimatedHours').value = task.estimatedHours || '';
    }

    handleTaskSubmit(e) {
        e.preventDefault();
        
        const formData = {
            title: document.getElementById('taskTitle').value.trim(),
            description: document.getElementById('taskDescription').value.trim(),
            subject: document.getElementById('taskSubject').value,
            priority: document.getElementById('taskPriority').value,
            dueDate: document.getElementById('taskDueDate').value,
            estimatedHours: parseFloat(document.getElementById('taskEstimatedHours').value) || 0
        };

        if (!formData.title || !formData.subject || !formData.dueDate) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        if (this.editingTaskId) {
            this.updateTask(this.editingTaskId, formData);
        } else {
            this.addTask(formData);
        }

        this.closeTaskModal();
    }

    addTask(taskData) {
        const task = {
            id: Date.now().toString(),
            ...taskData,
            completed: false,
            createdAt: new Date().toISOString(),
            completedAt: null
        };

        this.tasks.push(task);
        this.saveTasks();
        this.logActivity(`Created task: ${task.title}`);
        this.checkAchievements();
        this.showToast('Task added successfully!', 'success');
    }

    updateTask(taskId, taskData) {
        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            this.tasks[taskIndex] = { ...this.tasks[taskIndex], ...taskData };
            this.saveTasks();
            this.logActivity(`Updated task: ${taskData.title}`);
            this.showToast('Task updated successfully!', 'success');
        }
    }

    deleteTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task && confirm('Are you sure you want to delete this task?')) {
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.saveTasks();
            this.logActivity(`Deleted task: ${task.title}`);
            this.showToast('Task deleted!', 'info');
        }
    }

    toggleTaskComplete(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            task.completedAt = task.completed ? new Date().toISOString() : null;
            
            if (task.completed) {
                this.studyGoal.currentHours += task.estimatedHours || 0;
                this.saveStudyGoal();
                this.logActivity(`Completed task: ${task.title}`);
                this.showToast('Task completed! 🎉', 'success');
            } else {
                this.studyGoal.currentHours -= task.estimatedHours || 0;
                this.studyGoal.currentHours = Math.max(0, this.studyGoal.currentHours);
                this.saveStudyGoal();
                this.logActivity(`Uncompleted task: ${task.title}`);
            }
            
            this.saveTasks();
            this.checkAchievements();
        }
    }

    // Filtering and Searching
    filterTasks() {
        const searchTerm = document.getElementById('searchTasks').value.toLowerCase();
        const subjectFilter = document.getElementById('filterSubject').value;
        const priorityFilter = document.getElementById('filterPriority').value;
        const statusFilter = document.getElementById('filterStatus').value;

        let filteredTasks = this.tasks.filter(task => {
            const matchesSearch = task.title.toLowerCase().includes(searchTerm) ||
                                task.description.toLowerCase().includes(searchTerm);
            const matchesSubject = !subjectFilter || task.subject === subjectFilter;
            const matchesPriority = !priorityFilter || task.priority === priorityFilter;
            const matchesStatus = !statusFilter || this.getTaskStatus(task) === statusFilter;

            return matchesSearch && matchesSubject && matchesPriority && matchesStatus;
        });

        this.renderTasksList(filteredTasks);
    }

    getTaskStatus(task) {
        if (task.completed) return 'completed';
        if (new Date(task.dueDate) < new Date().setHours(0, 0, 0, 0)) return 'overdue';
        return 'pending';
    }

    // Rendering Methods
    renderDashboard() {
        this.updateStatsNumbers();
        this.renderUpcomingTasks();
        this.renderRecentActivity();
        this.updateProgressBar();
    }

    updateStats() {
        const totalTasks = this.tasks.length;
        const completedTasks = this.tasks.filter(t => t.completed).length;
        const pendingTasks = this.tasks.filter(t => !t.completed).length;
        const overdueTasks = this.tasks.filter(t => !t.completed && new Date(t.dueDate) < new Date()).length;
        const todayTasks = this.tasks.filter(t => this.isToday(new Date(t.dueDate))).length;
        const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        // Update header stats
        document.getElementById('totalTasks').textContent = totalTasks;
        document.getElementById('completedTasks').textContent = completedTasks;
        document.getElementById('progressPercentage').textContent = `${progressPercentage}%`;

        // Update progress circle
        const progressCircle = document.getElementById('progressCircle');
        const angle = (progressPercentage / 100) * 360;
        progressCircle.style.background = `conic-gradient(#4caf50 ${angle}deg, rgba(255, 255, 255, 0.2) ${angle}deg)`;

        // Update dashboard stats
        if (document.getElementById('pendingTasks')) {
            document.getElementById('pendingTasks').textContent = pendingTasks;
            document.getElementById('overdueTasks').textContent = overdueTasks;
            document.getElementById('todayTasks').textContent = todayTasks;
        }
    }

    updateStatsNumbers() {
        this.updateStats();
    }

    updateProgressBar() {
        const totalTasks = this.tasks.length;
        const completedTasks = this.tasks.filter(t => t.completed).length;
        const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');

        if (progressFill && progressText) {
            progressFill.style.width = `${progressPercentage}%`;
            progressText.textContent = `${Math.round(progressPercentage)}% Complete`;
        }
    }

    renderUpcomingTasks() {
        const container = document.getElementById('upcomingTasksList');
        if (!container) return;

        const upcomingTasks = this.tasks
            .filter(t => !t.completed)
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
            .slice(0, 5);

        if (upcomingTasks.length === 0) {
            container.innerHTML = '<p class="empty-state">No upcoming tasks</p>';
            return;
        }

        container.innerHTML = upcomingTasks.map(task => `
            <div class="upcoming-task">
                <div class="task-info">
                    <div class="task-name">${task.title}</div>
                    <span class="task-subject-small">${task.subject}</span>
                </div>
                <div class="due-info ${this.getDueClass(task)}">
                    ${this.formatDueDate(task.dueDate)}
                </div>
            </div>
        `).join('');
    }

    renderRecentActivity() {
        const container = document.getElementById('recentActivity');
        if (!container || this.activityLog.length === 0) {
            if (container) container.innerHTML = '<p class="empty-state">No recent activity</p>';
            return;
        }

        container.innerHTML = this.activityLog
            .slice(-5)
            .reverse()
            .map(activity => `
                <div class="activity-item">
                    <div>${activity.action}</div>
                    <small>${this.formatTime(activity.timestamp)}</small>
                </div>
            `).join('');
    }

    renderTasks() {
        this.renderTasksList(this.tasks);
    }

    renderTasksList(tasks) {
        const container = document.getElementById('tasksList');
        
        if (tasks.length === 0) {
            container.innerHTML = '<p class="empty-state">No tasks found.</p>';
            return;
        }

        // Sort tasks by due date, priority, and completion status
        const sortedTasks = [...tasks].sort((a, b) => {
            if (a.completed !== b.completed) {
                return a.completed ? 1 : -1;
            }
            if (a.priority !== b.priority) {
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            return new Date(a.dueDate) - new Date(b.dueDate);
        });

        container.innerHTML = sortedTasks.map(task => this.createTaskCard(task)).join('');
    }

    createTaskCard(task) {
        const isOverdue = !task.completed && new Date(task.dueDate) < new Date();
        const isToday = this.isToday(new Date(task.dueDate));
        const cardClass = task.completed ? 'completed' : isOverdue ? 'overdue' : '';

        return `
            <div class="task-card ${cardClass}" data-task-id="${task.id}">
                <div class="task-header">
                    <h3 class="task-title">${task.title}</h3>
                    <span class="task-priority priority-${task.priority}">${task.priority}</span>
                </div>
                <div class="task-meta">
                    <span class="task-subject">${task.subject}</span>
                    <span class="task-due-date ${isOverdue ? 'overdue' : isToday ? 'today' : ''}">
                        ${this.formatDueDate(task.dueDate)}
                    </span>
                </div>
                ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
                <div class="task-actions">
                    <button class="btn ${task.completed ? 'btn-warning' : 'btn-success'}" 
                            onclick="studyPlanner.toggleTaskComplete('${task.id}')">
                        <i class="fas ${task.completed ? 'fa-undo' : 'fa-check'}"></i>
                        ${task.completed ? 'Undo' : 'Complete'}
                    </button>
                    <button class="btn btn-secondary" onclick="studyPlanner.openTaskModal('${task.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger" onclick="studyPlanner.deleteTask('${task.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }

    renderCalendar() {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        
        document.getElementById('currentMonth').textContent = 
            `${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;

        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        const calendarDays = document.getElementById('calendarDays');
        calendarDays.innerHTML = '';

        for (let i = 0; i < 42; i++) {
            const currentDay = new Date(startDate);
            currentDay.setDate(startDate.getDate() + i);

            const dayTasks = this.tasks.filter(task => 
                this.isSameDate(new Date(task.dueDate), currentDay)
            );

            const isCurrentMonth = currentDay.getMonth() === this.currentDate.getMonth();
            const isToday = this.isToday(currentDay);
            const hasTasks = dayTasks.length > 0;

            const dayClass = [
                'calendar-day',
                !isCurrentMonth ? 'other-month' : '',
                isToday ? 'today' : '',
                hasTasks ? 'has-tasks' : ''
            ].filter(Boolean).join(' ');

            calendarDays.innerHTML += `
                <div class="${dayClass}">
                    <span class="day-number">${currentDay.getDate()}</span>
                    ${hasTasks ? `<div class="day-tasks">${dayTasks.length} task${dayTasks.length > 1 ? 's' : ''}</div>` : ''}
                </div>
            `;
        }
    }

    renderGoals() {
        const currentHours = document.getElementById('currentHours');
        const targetHours = document.getElementById('targetHours');
        const goalProgressFill = document.getElementById('goalProgressFill');
        const studyHoursGoal = document.getElementById('studyHoursGoal');

        if (currentHours) currentHours.textContent = this.studyGoal.currentHours.toFixed(1);
        if (targetHours) targetHours.textContent = this.studyGoal.weeklyHours;
        if (studyHoursGoal) studyHoursGoal.value = this.studyGoal.weeklyHours;

        const progressPercentage = Math.min((this.studyGoal.currentHours / this.studyGoal.weeklyHours) * 100, 100);
        if (goalProgressFill) goalProgressFill.style.width = `${progressPercentage}%`;

        // Check if we need to reset weekly progress
        const currentWeekStart = this.getWeekStart();
        if (currentWeekStart > this.studyGoal.weekStart) {
            this.studyGoal.currentHours = 0;
            this.studyGoal.weekStart = currentWeekStart;
            this.saveStudyGoal();
        }
    }

    // Calendar Navigation
    changeMonth(direction) {
        this.currentDate.setMonth(this.currentDate.getMonth() + direction);
        this.renderCalendar();
    }

    // Goals Management
    setStudyGoal() {
        const newGoal = parseInt(document.getElementById('studyHoursGoal').value);
        if (newGoal > 0) {
            this.studyGoal.weeklyHours = newGoal;
            this.saveStudyGoal();
            this.showToast('Study goal updated!', 'success');
        }
    }

    // Achievements
    checkAchievements() {
        let newAchievements = 0;

        // First task achievement
        if (!this.achievements.firstTask && this.tasks.some(t => t.completed)) {
            this.achievements.firstTask = true;
            newAchievements++;
            this.showToast('Achievement unlocked: First Task! 🏆', 'success');
        }

        // Goal achiever
        if (!this.achievements.goalAchiever && this.studyGoal.currentHours >= this.studyGoal.weeklyHours) {
            this.achievements.goalAchiever = true;
            newAchievements++;
            this.showToast('Achievement unlocked: Goal Achiever! 🌟', 'success');
        }

        // Study streak (7 days with at least one completed task)
        if (!this.achievements.studyStreak && this.checkStudyStreak()) {
            this.achievements.studyStreak = true;
            newAchievements++;
            this.showToast('Achievement unlocked: Study Streak! 🔥', 'success');
        }

        if (newAchievements > 0) {
            this.saveAchievements();
            this.updateAchievementsDisplay();
        }
    }

    checkStudyStreak() {
        const last7Days = [];
        const today = new Date();
        
        for (let i = 0; i < 7; i++) {
            const day = new Date(today);
            day.setDate(today.getDate() - i);
            last7Days.push(day.toDateString());
        }

        return last7Days.every(day => {
            return this.tasks.some(task => 
                task.completed && 
                task.completedAt && 
                new Date(task.completedAt).toDateString() === day
            );
        });
    }

    updateAchievementsDisplay() {
        const achievementsList = document.getElementById('achievementsList');
        if (!achievementsList) return;

        const achievements = [
            { key: 'firstTask', title: 'First Task', description: 'Complete your first study task', icon: 'fa-medal' },
            { key: 'studyStreak', title: 'Study Streak', description: 'Complete tasks for 7 days straight', icon: 'fa-fire' },
            { key: 'goalAchiever', title: 'Goal Achiever', description: 'Meet your weekly study goal', icon: 'fa-star' }
        ];

        achievementsList.innerHTML = achievements.map(achievement => `
            <div class="achievement ${this.achievements[achievement.key] ? 'unlocked' : ''}">
                <i class="fas ${achievement.icon} achievement-icon"></i>
                <div class="achievement-info">
                    <h4>${achievement.title}</h4>
                    <p>${achievement.description}</p>
                </div>
                <div class="achievement-status ${this.achievements[achievement.key] ? 'unlocked' : 'pending'}">
                    <i class="fas ${this.achievements[achievement.key] ? 'fa-trophy' : 'fa-lock'}"></i>
                </div>
            </div>
        `).join('');
    }

    // Reminders and Notifications
    checkReminders() {
        const now = new Date();
        const today = now.toDateString();
        const overdueTasks = this.tasks.filter(task => 
            !task.completed && new Date(task.dueDate) < now
        );
        const todayTasks = this.tasks.filter(task => 
            !task.completed && new Date(task.dueDate).toDateString() === today
        );

        // Show browser notifications for overdue tasks
        if (overdueTasks.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('Study Planner Reminder', {
                body: `You have ${overdueTasks.length} overdue task(s)!`,
                icon: '/favicon.ico'
            });
        }
    }

    // Activity Logging
    logActivity(action) {
        this.activityLog.push({
            action,
            timestamp: new Date().toISOString()
        });
        this.saveActivityLog();
    }

    // Utility Methods
    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    isSameDate(date1, date2) {
        return date1.toDateString() === date2.toDateString();
    }

    formatDueDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = date - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Due Today';
        if (diffDays === 1) return 'Due Tomorrow';
        if (diffDays === -1) return '1 day overdue';
        if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
        if (diffDays <= 7) return `${diffDays} days left`;
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    getDueClass(task) {
        const date = new Date(task.dueDate);
        const now = new Date();
        const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return 'overdue';
        if (diffDays === 0) return 'today';
        return 'upcoming';
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffHours = Math.floor((now - date) / (1000 * 60 * 60));

        if (diffHours < 1) return 'Just now';
        if (diffHours < 24) return `${diffHours}h ago`;
        
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    }

    getWeekStart() {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day;
        return new Date(now.setDate(diff)).setHours(0, 0, 0, 0);
    }

    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Initialize the Study Planner when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.studyPlanner = new StudyPlanner();
});

// Service Worker for offline functionality (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}