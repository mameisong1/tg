import {
	createSSRApp
} from "vue";
import App from "./App.vue";
import errorReporter from "./utils/error-reporter.js";

export function createApp() {
	const app = createSSRApp(App);
	
	// 初始化全局错误捕获
	errorReporter.init();
	
	// Vue全局错误处理器
	app.config.errorHandler = (err, vm, info) => {
		errorReporter.report({
			type: 'vue_error',
			message: err?.message || String(err),
			stack: err?.stack || '',
			component: vm?.$options?.name || 'unknown',
			info: info || ''
		});
	};
	
	return {
		app,
	};
}
