<template>
    <view v-if="visible" class="modal-mask" @click="close">
        <view class="modal-content" @click.stop>
            <view class="modal-header">
                <text class="modal-title">选择{{ productName }}</text>
                <view class="modal-close" @click="close">✕</view>
            </view>

            <!-- 温度选项 -->
            <view class="option-group" v-if="temperatureOptions.length > 0">
                <text class="option-label">温度</text>
                <view class="option-list">
                    <view 
                        v-for="temp in temperatureOptions" 
                        :key="temp"
                        class="option-item"
                        :class="{ active: selectedTemperature === temp }"
                        @click="selectedTemperature = temp"
                    >
                        {{ temp }}
                    </view>
                </view>
            </view>

            <!-- 糖度选项 -->
            <view class="option-group" v-if="sugarOptions.length > 0">
                <text class="option-label">糖度</text>
                <view class="option-list">
                    <view 
                        v-for="sugar in sugarOptions" 
                        :key="sugar"
                        class="option-item"
                        :class="{ active: selectedSugar === sugar }"
                        @click="selectedSugar = sugar"
                    >
                        {{ sugar }}
                    </view>
                </view>
            </view>

            <view class="modal-footer">
                <view class="btn-confirm" @click="confirm">确定</view>
            </view>
        </view>
    </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import api from '@/utils/api.js';

const props = defineProps({
    visible: Boolean,
    product: Object
});

const emit = defineEmits(['confirm', 'close']);

const productName = computed(() => props.product?.name || '');
const temperatureOptions = ref([]);
const sugarOptions = ref([]);
const selectedTemperature = ref('');
const selectedSugar = ref('');

// 加载选项
async function loadOptions() {
    if (!props.product) return;
    try {
        const result = await api.getProductOptions(props.product.category, props.product.name);
        if (result && result.options) {
            const opt = result.options;
            // 温度和糖度用 / 或 + 分隔
            temperatureOptions.value = opt.temperature ? opt.temperature.split(/[\/\+]/).filter(t => t) : [];
            sugarOptions.value = opt.sugar ? opt.sugar.split(/[\/\+]/).filter(s => s) : [];
            // 默认选中第一个
            selectedTemperature.value = temperatureOptions.value[0] || '';
            selectedSugar.value = sugarOptions.value[0] || '';
        }
    } catch (e) {
        console.error('加载商品选项失败:', e);
    }
}

// 确定
function confirm() {
    const options = [];
    if (selectedTemperature.value) options.push(selectedTemperature.value);
    if (selectedSugar.value) options.push(selectedSugar.value);
    emit('confirm', {
        product: props.product,
        options: options.join('')
    });
}

function close() {
    emit('close');
}

// 每次显示时重新加载
watch(() => props.visible, (val) => {
    if (val) loadOptions();
});
</script>

<style scoped>
.modal-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 999;
    display: flex;
    align-items: flex-end;
}
.modal-content {
    background: #fff;
    border-radius: 20rpx 20rpx 0 0;
    padding: 40rpx;
    width: 100%;
}
.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30rpx;
}
.modal-title {
    font-size: 32rpx;
    font-weight: bold;
}
.modal-close {
    font-size: 40rpx;
    color: #999;
}
.option-group {
    margin-bottom: 30rpx;
}
.option-label {
    font-size: 28rpx;
    color: #333;
    margin-bottom: 15rpx;
    display: block;
}
.option-list {
    display: flex;
    flex-wrap: wrap;
    gap: 15rpx;
}
.option-item {
    padding: 12rpx 24rpx;
    border: 1rpx solid #ddd;
    border-radius: 30rpx;
    font-size: 26rpx;
}
.option-item.active {
    background: #e6553a;
    color: #fff;
    border-color: #e6553a;
}
.modal-footer {
    margin-top: 30rpx;
}
.btn-confirm {
    background: #e6553a;
    color: #fff;
    text-align: center;
    padding: 20rpx;
    border-radius: 40rpx;
    font-size: 30rpx;
}
</style>