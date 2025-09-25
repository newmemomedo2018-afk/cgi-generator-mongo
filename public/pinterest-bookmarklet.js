// Pinterest Helper Bookmarklet - Minified Version
// Drag this to your bookmarks bar to use on Pinterest!

javascript:(function(){
  var script = document.createElement('script');
  script.src = '/pinterest-helper.js?t=' + Date.now();
  script.onload = function() {
    console.log('🎯 Pinterest Helper loaded via bookmarklet!');
  };
  script.onerror = function() {
    // Fallback - inline version
    (function() {
      'use strict';
      if (!window.location.hostname.includes('pinterest.com')) {
        alert('❌ هذا يعمل على Pinterest فقط!');
        return;
      }
      
      var overlay = document.createElement('div');
      overlay.id = 'pinterest-bookmarklet-helper';
      overlay.innerHTML = `
        <div style="position:fixed;top:20px;right:20px;z-index:99999;background:linear-gradient(135deg,#e60023,#ff4757);color:white;padding:15px;border-radius:15px;box-shadow:0 10px 30px rgba(230,0,35,0.3);font-family:Arial,sans-serif;width:300px;font-size:13px;user-select:none;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <strong>🎯 Pinterest Helper</strong>
            <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background:rgba(255,255,255,0.2);border:none;color:white;width:25px;height:25px;border-radius:50%;cursor:pointer;">×</button>
          </div>
          <div style="margin-bottom:10px;font-size:11px;opacity:0.9;">
            اضغط على أي صورة Pinterest لنسخ رابطها!
          </div>
          <button id="pinterest-activate-helper" style="width:100%;background:rgba(255,255,255,0.9);border:none;color:#e60023;padding:8px;border-radius:8px;cursor:pointer;font-weight:bold;">
            🤖 تفعيل النسخ التلقائي
          </button>
        </div>
      `;
      document.body.appendChild(overlay);
      
      var isActive = false;
      var activateBtn = document.getElementById('pinterest-activate-helper');
      
      activateBtn.onclick = function() {
        isActive = !isActive;
        if (isActive) {
          this.textContent = '⏹ إيقاف النسخ التلقائي';
          this.style.background = 'rgba(255,255,255,0.9)';
          
          // Add click listeners to all images
          var images = document.querySelectorAll('img[src*="pinimg.com"]');
          images.forEach(function(img) {
            if (!img.hasAttribute('data-helper-attached')) {
              img.setAttribute('data-helper-attached', 'true');
              img.style.cursor = 'copy';
              img.style.border = '2px solid transparent';
              img.style.transition = 'border 0.2s ease';
              
              img.addEventListener('click', function(e) {
                if (isActive) {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  var imageUrl = img.src || img.dataset.src;
                  if (imageUrl && imageUrl.includes('pinimg.com')) {
                    // Enhance quality
                    imageUrl = imageUrl.replace(/\\d+x\\d+/, '1920x1080').replace('/236x/', '/1920x/').replace('/474x/', '/1920x/');
                    
                    // Copy to clipboard
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(imageUrl);
                    }
                    
                    // Store in localStorage
                    try {
                      localStorage.setItem('pinterest_copied_url', imageUrl);
                      localStorage.setItem('pinterest_copied_timestamp', Date.now().toString());
                    } catch(e) {}
                    
                    // Visual feedback
                    img.style.border = '2px solid #e60023';
                    setTimeout(function() {
                      img.style.border = '2px solid transparent';
                    }, 1000);
                    
                    // Update status
                    overlay.querySelector('div[style*="margin-bottom:10px"]').textContent = '✅ تم نسخ الرابط!';
                    setTimeout(function() {
                      if (overlay.querySelector('div[style*="margin-bottom:10px"]')) {
                        overlay.querySelector('div[style*="margin-bottom:10px"]').textContent = 'اضغط على أي صورة Pinterest لنسخ رابطها!';
                      }
                    }, 3000);
                    
                    console.log('📋 Pinterest Helper: Copied ->', imageUrl);
                  }
                }
              });
              
              img.addEventListener('mouseover', function() {
                if (isActive) {
                  this.style.border = '2px solid #ff4757';
                  this.title = 'اضغط لنسخ رابط الصورة';
                }
              });
              
              img.addEventListener('mouseout', function() {
                if (isActive) {
                  this.style.border = '2px solid transparent';
                }
              });
            }
          });
        } else {
          this.textContent = '🤖 تفعيل النسخ التلقائي';
          this.style.background = 'rgba(255,255,255,0.2)';
        }
      };
    })();
  };
  document.head.appendChild(script);
})();