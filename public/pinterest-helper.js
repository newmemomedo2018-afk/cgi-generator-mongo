/**
 * Pinterest Image URL Copier - Helper Script
 * يساعد المستخدم في نسخ روابط الصور من Pinterest تلقائياً
 */

(function() {
    'use strict';
    
    // إنشاء overlay للتحكم
    function createPinterestHelper() {
        // تحقق من وجود Pinterest
        if (!window.location.hostname.includes('pinterest.com')) {
            alert('❌ هذا السكريبت يعمل على Pinterest فقط!');
            return;
        }

        // حذف أي overlay موجود مسبقاً
        const existingOverlay = document.getElementById('pinterest-helper-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        // إنشاء HTML للـ overlay
        const overlayHTML = `
            <div id="pinterest-helper-overlay" style="
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 99999;
                background: linear-gradient(135deg, #e60023, #ff4757);
                color: white;
                padding: 20px;
                border-radius: 20px;
                box-shadow: 0 10px 30px rgba(230, 0, 35, 0.3);
                font-family: Arial, sans-serif;
                width: 350px;
                font-size: 14px;
                cursor: move;
                user-select: none;
            ">
                <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 15px;">
                    <div>
                        <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">
                            🎯 Pinterest Helper
                        </div>
                        <div style="font-size: 12px; opacity: 0.9;">
                            اضغط على أي صورة لنسخ رابطها تلقائياً
                        </div>
                    </div>
                    <button id="pinterest-helper-close" style="
                        background: rgba(255,255,255,0.2);
                        border: none;
                        color: white;
                        width: 30px;
                        height: 30px;
                        border-radius: 50%;
                        cursor: pointer;
                        font-size: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">×</button>
                </div>
                
                <div id="pinterest-status" style="
                    background: rgba(255,255,255,0.1);
                    padding: 12px;
                    border-radius: 10px;
                    margin-bottom: 15px;
                    text-align: center;
                    font-size: 13px;
                ">
                    🟢 جاهز - اضغط على أي صورة Pinterest
                </div>
                
                <div id="pinterest-copied-url" style="
                    background: rgba(255,255,255,0.1);
                    padding: 10px;
                    border-radius: 8px;
                    font-size: 11px;
                    font-family: monospace;
                    word-break: break-all;
                    max-height: 60px;
                    overflow-y: auto;
                    display: none;
                ">
                    <!-- Copied URL will appear here -->
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <button id="pinterest-auto-copy" style="
                        flex: 1;
                        background: rgba(255,255,255,0.2);
                        border: none;
                        color: white;
                        padding: 10px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 12px;
                        font-weight: bold;
                    ">🤖 تفعيل النسخ التلقائي</button>
                    <button id="pinterest-paste-app" style="
                        flex: 1;
                        background: rgba(255,255,255,0.9);
                        border: none;
                        color: #e60023;
                        padding: 10px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 12px;
                        font-weight: bold;
                    ">📋 لصق في التطبيق</button>
                </div>
            </div>
        `;

        // إضافة الـ overlay للصفحة
        document.body.insertAdjacentHTML('beforeend', overlayHTML);
        
        // المتغيرات
        let isAutoCopyEnabled = false;
        let lastCopiedUrl = '';
        let copiedUrls = [];
        
        // العناصر
        const overlay = document.getElementById('pinterest-helper-overlay');
        const statusDiv = document.getElementById('pinterest-status');
        const copiedUrlDiv = document.getElementById('pinterest-copied-url');
        const autoCopyBtn = document.getElementById('pinterest-auto-copy');
        const pasteAppBtn = document.getElementById('pinterest-paste-app');
        const closeBtn = document.getElementById('pinterest-helper-close');

        // إعداد الأحداث
        closeBtn.addEventListener('click', () => overlay.remove());
        
        // تفعيل/إلغاء النسخ التلقائي
        autoCopyBtn.addEventListener('click', () => {
            isAutoCopyEnabled = !isAutoCopyEnabled;
            if (isAutoCopyEnabled) {
                autoCopyBtn.textContent = '⏹ إيقاف النسخ التلقائي';
                autoCopyBtn.style.background = 'rgba(255,255,255,0.9)';
                autoCopyBtn.style.color = '#e60023';
                statusDiv.innerHTML = '🔄 النسخ التلقائي مُفعل - اضغط على أي صورة';
                statusDiv.style.background = 'rgba(76, 175, 80, 0.2)';
                
                // إضافة event listeners لجميع الصور
                attachImageListeners();
            } else {
                autoCopyBtn.textContent = '🤖 تفعيل النسخ التلقائي';
                autoCopyBtn.style.background = 'rgba(255,255,255,0.2)';
                autoCopyBtn.style.color = 'white';
                statusDiv.innerHTML = '🟡 النسخ التلقائي مُوقف';
                statusDiv.style.background = 'rgba(255,255,255,0.1)';
            }
        });
        
        // لصق في التطبيق
        pasteAppBtn.addEventListener('click', () => {
            if (lastCopiedUrl) {
                // محاولة إرسال الرابط للتطبيق
                sendUrlToApp(lastCopiedUrl);
            } else {
                statusDiv.innerHTML = '❌ لا يوجد رابط للإرسال - انسخ صورة أولاً';
                statusDiv.style.background = 'rgba(244, 67, 54, 0.2)';
            }
        });

        // جعل الـ overlay قابل للسحب
        makeDraggable(overlay);
        
        // وظيفة نسخ URL من صورة Pinterest
        function copyImageUrl(img) {
            let imageUrl = '';
            
            // البحث عن رابط الصورة الأصلية
            if (img.src && img.src.includes('pinimg.com')) {
                imageUrl = img.src;
            } else if (img.dataset && img.dataset.src && img.dataset.src.includes('pinimg.com')) {
                imageUrl = img.dataset.src;
            } else {
                // البحث في الـ srcset
                if (img.srcset) {
                    const srcsetUrls = img.srcset.split(',');
                    for (let srcUrl of srcsetUrls) {
                        const url = srcUrl.trim().split(' ')[0];
                        if (url.includes('pinimg.com')) {
                            imageUrl = url;
                            break;
                        }
                    }
                }
            }
            
            if (imageUrl) {
                // تحسين جودة الصورة - محاولة الحصول على أعلى جودة
                imageUrl = imageUrl.replace(/\d+x\d+/, '1920x1080')
                                 .replace('/236x/', '/1920x/')
                                 .replace('/474x/', '/1920x/')
                                 .replace('/736x/', '/1920x/');
                
                // نسخ للحافظة
                copyToClipboard(imageUrl);
                lastCopiedUrl = imageUrl;
                copiedUrls.push(imageUrl);
                
                // تحديث الواجهة
                statusDiv.innerHTML = `✅ تم نسخ رابط الصورة بنجاح!`;
                statusDiv.style.background = 'rgba(76, 175, 80, 0.2)';
                
                copiedUrlDiv.textContent = imageUrl;
                copiedUrlDiv.style.display = 'block';
                
                // محاولة إرسال للتطبيق تلقائياً
                setTimeout(() => {
                    sendUrlToApp(imageUrl);
                }, 500);
                
                console.log('📋 Pinterest Helper: Copied URL ->', imageUrl);
            } else {
                statusDiv.innerHTML = '❌ لم يتم العثور على رابط صورة صالح';
                statusDiv.style.background = 'rgba(244, 67, 54, 0.2)';
            }
        }
        
        // نسخ للحافظة
        function copyToClipboard(text) {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).catch(err => {
                    console.error('Failed to copy to clipboard:', err);
                    fallbackCopyToClipboard(text);
                });
            } else {
                fallbackCopyToClipboard(text);
            }
        }
        
        // النسخ البديل
        function fallbackCopyToClipboard(text) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
        
        // إرسال URL للتطبيق
        function sendUrlToApp(url) {
            // محاولة إرسال message للنافذة الأب (التطبيق)
            if (window.opener) {
                window.opener.postMessage({
                    type: 'PINTEREST_IMAGE_URL',
                    url: url,
                    timestamp: Date.now()
                }, '*');
                
                statusDiv.innerHTML = '📤 تم إرسال الرابط للتطبيق تلقائياً!';
                statusDiv.style.background = 'rgba(33, 150, 243, 0.2)';
            }
            
            // محاولة localStorage للتطبيقات المحلية
            try {
                localStorage.setItem('pinterest_copied_url', url);
                localStorage.setItem('pinterest_copied_timestamp', Date.now().toString());
            } catch (e) {
                console.log('LocalStorage not available');
            }
        }
        
        // إضافة event listeners للصور
        function attachImageListeners() {
            const images = document.querySelectorAll('img[src*="pinimg.com"], img[data-src*="pinimg.com"]');
            
            images.forEach(img => {
                if (!img.hasAttribute('data-pinterest-helper')) {
                    img.setAttribute('data-pinterest-helper', 'true');
                    img.style.cursor = 'pointer';
                    img.style.border = '2px solid transparent';
                    img.style.transition = 'border 0.2s ease';
                    
                    img.addEventListener('click', (e) => {
                        if (isAutoCopyEnabled) {
                            e.preventDefault();
                            e.stopPropagation();
                            copyImageUrl(img);
                            
                            // تأثير بصري
                            img.style.border = '2px solid #e60023';
                            setTimeout(() => {
                                img.style.border = '2px solid transparent';
                            }, 1000);
                        }
                    });
                    
                    img.addEventListener('mouseover', () => {
                        if (isAutoCopyEnabled) {
                            img.style.border = '2px solid #ff4757';
                            img.title = 'اضغط لنسخ رابط الصورة';
                        }
                    });
                    
                    img.addEventListener('mouseout', () => {
                        if (isAutoCopyEnabled) {
                            img.style.border = '2px solid transparent';
                        }
                    });
                }
            });
            
            // مراقبة الصور الجديدة (للتحميل الديناميكي)
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            const newImages = node.querySelectorAll ? 
                                node.querySelectorAll('img[src*="pinimg.com"], img[data-src*="pinimg.com"]') : 
                                [];
                            newImages.forEach(img => {
                                if (!img.hasAttribute('data-pinterest-helper') && isAutoCopyEnabled) {
                                    attachImageListeners();
                                }
                            });
                        }
                    });
                });
            });
            
            observer.observe(document.body, { childList: true, subtree: true });
        }
        
        // جعل النافذة قابلة للسحب
        function makeDraggable(element) {
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
            element.onmousedown = dragMouseDown;
            
            function dragMouseDown(e) {
                e = e || window.event;
                e.preventDefault();
                pos3 = e.clientX;
                pos4 = e.clientY;
                document.onmouseup = closeDragElement;
                document.onmousemove = elementDrag;
            }
            
            function elementDrag(e) {
                e = e || window.event;
                e.preventDefault();
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                element.style.top = (element.offsetTop - pos2) + "px";
                element.style.right = "auto";
                element.style.left = (element.offsetLeft - pos1) + "px";
            }
            
            function closeDragElement() {
                document.onmouseup = null;
                document.onmousemove = null;
            }
        }
        
        console.log('🎯 Pinterest Helper loaded successfully!');
    }
    
    // تشغيل المساعد
    createPinterestHelper();
})();