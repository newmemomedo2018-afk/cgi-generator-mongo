setInterval(async () => {
  try {
    const response = await fetch('https://cgi-generator-mongo.onrender.com/api/process-job', {
      method: 'POST'
    });
    console.log('Job processing:', response.status);
  } catch (error) {
    console.error('Job processing error:', error);
  }
}, 30000); // كل 30 ثانية
