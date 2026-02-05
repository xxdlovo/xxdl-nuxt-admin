// 定义允许的Toast类型
type ToastType = "error" | "info" | "success" | "primary" | "secondary" | "warning" | "neutral";

// 创建通用的Toast生成函数
const createToast = (type: ToastType) => {
    // 保留参数顺序：title, message?, duration?
    return (title: string, duration?: number, message?: string) => {
        toast(title, type, message, duration);
    };
};

// 生成各种类型的Toast函数
export const useToastSuccess = createToast('success');
export const useToastInfo = createToast('info');
export const useToastError = createToast('error');
export const useToastWarning = createToast('warning');

function toast(title: string, type: ToastType, message?: string, duration?: number) {
    const appConfig = useAppConfig()
    if (duration) {
        appConfig.toaster.duration = duration
    } else {
        appConfig.toaster.duration = 5000
    }
    useToast().add({
        title: title,
        description: message,
        color: type
    })
}