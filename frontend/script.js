const API_URL=window.location.origin;let currentScheduleId=null;let currentTab='schedules';const token=localStorage.getItem('token');if(!token&&window.location.pathname==='/dashboard'){window.location.href='/login'}
const username=localStorage.getItem('username');if(username){const usernameSpan=document.getElementById('username');if(usernameSpan)usernameSpan.textContent=username}
function toggleSidebar(){const sidebar=document.getElementById('sidebar');if(sidebar){sidebar.classList.toggle('mobile-open')}}
document.addEventListener('click',function(event){const sidebar=document.getElementById('sidebar');const toggleBtn=document.querySelector('.menu-toggle');if(window.innerWidth<=768&&sidebar&&sidebar.classList.contains('mobile-open')){if(!sidebar.contains(event.target)&&!toggleBtn?.contains(event.target)){sidebar.classList.remove('mobile-open')}}});function showTab(tab){currentTab=tab;const statsSection=document.getElementById('statsSection');const schedulesList=document.getElementById('schedulesList');const helpSection=document.getElementById('helpSection');if(tab==='schedules'){if(statsSection)statsSection.style.display='block';if(schedulesList)schedulesList.style.display='flex';if(helpSection)helpSection.style.display='none';loadSchedules()}else if(tab==='stats'){if(statsSection)statsSection.style.display='block';if(schedulesList)schedulesList.style.display='flex';if(helpSection)helpSection.style.display='none';loadSchedules()}else if(tab==='help'){if(statsSection)statsSection.style.display='none';if(schedulesList)schedulesList.style.display='none';if(helpSection)helpSection.style.display='block'}
document.querySelectorAll('.menu-item').forEach(item=>{item.classList.remove('active')});if(event?.currentTarget){event.currentTarget.classList.add('active')}}
async function loadSchedules(){try{const response=await fetch(`${API_URL}/api/schedules`,{headers:{'Authorization':`Bearer ${token}`}});if(!response.ok){if(response.status===401){localStorage.removeItem('token');localStorage.removeItem('username');window.location.href='/login'}
throw new Error('Failed to load schedules')}
const schedules=await response.json();displaySchedules(schedules);updateStats(schedules)}catch(error){console.error('Error loading schedules:',error);showNotification('Failed to load schedules','error')}}
function displaySchedules(schedules){const container=document.getElementById('schedulesList');if(!container)return;if(schedules.length===0){container.innerHTML=`
            <div class="no-schedules">
                <i class="fas fa-calendar-alt" style="font-size: 48px; margin-bottom: 20px;"></i>
                <h3>No schedules yet</h3>
                <p>Click "New Schedule" to create your first scheduled message</p>
            </div>
        `;return}
container.innerHTML=schedules.map(schedule=>`
        <div class="schedule-card">
            <div class="schedule-header">
                <div class="schedule-name">
                    <i class="fas fa-tasks"></i> ${escapeHtml(schedule.name)}
                </div>
                <div class="schedule-status ${schedule.isActive ? 'status-active' : 'status-inactive'}">
                    <i class="fas ${schedule.isActive ? 'fa-play' : 'fa-pause'}"></i>
                    ${schedule.isActive ? 'Active' : 'Inactive'}
                </div>
            </div>
            <div class="schedule-details">
                <div><i class="fab fa-telegram"></i> <strong>Channel:</strong> ${escapeHtml(schedule.channelName || schedule.channelId)}</div>
                <div><i class="fas fa-clock"></i> <strong>Interval:</strong> ${formatInterval(schedule)}</div>
                <div><i class="fas fa-hourglass-half"></i> <strong>Next Run:</strong> ${new Date(schedule.nextRunTime).toLocaleString()}</div>
                ${schedule.lastSent ? `<div><i class="fas fa-check-circle"></i><strong>Last Sent:</strong>${new Date(schedule.lastSent).toLocaleString()}</div>` : ''}
                <div><i class="fas fa-chart-simple"></i> <strong>Sent:</strong> ${schedule.sentCount || 0}${schedule.maxSends ? '/' + schedule.maxSends : ''}</div>
                ${schedule.endDate ? `<div><i class="fas fa-calendar-times"></i><strong>Ends:</strong>${new Date(schedule.endDate).toLocaleString()}</div>` : ''}
                ${schedule.buttons && schedule.buttons.length > 0 ? `<div><i class="fas fa-link"></i><strong>Buttons:</strong>${schedule.buttons.length}button(s)</div>` : ''}
            </div>
            <div class="schedule-message">
                <i class="fas fa-envelope"></i> ${escapeHtml(schedule.message.substring(0, 150))}${schedule.message.length > 150 ? '...' : ''}
            </div>
            <div class="schedule-actions">
                <button onclick="editSchedule('${schedule._id}')" class="btn-secondary">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button onclick="toggleSchedule('${schedule._id}')" class="btn-secondary">
                    <i class="fas ${schedule.isActive ? 'fa-pause' : 'fa-play'}"></i>
                    ${schedule.isActive ? 'Pause' : 'Activate'}
                </button>
                <button onclick="deleteSchedule('${schedule._id}')" class="btn-danger">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('')}
function formatInterval(schedule){switch(schedule.interval){case 'every_minute':return'Every minute';case 'every_2_hours':return'Every 2 hours';case 'daily':return `Daily at ${String(schedule.specificTime?.hour || 9).padStart(2, '0')}:${String(schedule.specificTime?.minute || 0).padStart(2, '0')}`;case 'weekly':return `Weekly at ${String(schedule.specificTime?.hour || 9).padStart(2, '0')}:${String(schedule.specificTime?.minute || 0).padStart(2, '0')}`;case 'custom':const minutes=schedule.customInterval;if(minutes>=1440)return `Every ${Math.floor(minutes / 1440)} days`;if(minutes>=60)return `Every ${Math.floor(minutes / 60)} hours`;return `Every ${minutes} minutes`;default:return schedule.interval}}
function updateStats(schedules){const activeCount=schedules.filter(s=>s.isActive).length;const totalCount=schedules.length;const completedCount=schedules.filter(s=>!s.isActive&&s.maxSends&&s.sentCount>=s.maxSends).length;const totalSent=schedules.reduce((sum,s)=>sum+(s.sentCount||0),0);const activeSpan=document.getElementById('activeCount');const totalSpan=document.getElementById('totalCount');const completedSpan=document.getElementById('completedCount');const totalSentSpan=document.getElementById('totalSent');if(activeSpan)activeSpan.textContent=activeCount;if(totalSpan)totalSpan.textContent=totalCount;if(completedSpan)completedSpan.textContent=completedCount;if(totalSentSpan)totalSentSpan.textContent=totalSent}
function showCreateForm(){currentScheduleId=null;const modalTitle=document.getElementById('modalTitle');if(modalTitle)modalTitle.innerHTML='<i class="fas fa-plus-circle"></i> Create New Schedule';const form=document.getElementById('scheduleForm');if(form)form.reset();const modal=document.getElementById('scheduleModal');if(modal)modal.style.display='flex';toggleIntervalOptions();toggleMessageType();if(window.innerWidth<=768){const sidebar=document.getElementById('sidebar');if(sidebar)sidebar.classList.remove('mobile-open');}}
async function editSchedule(id){try{const response=await fetch(`${API_URL}/api/schedules`,{headers:{'Authorization':`Bearer ${token}`}});if(!response.ok)throw new Error('Failed to load schedule');const schedules=await response.json();const schedule=schedules.find(s=>s._id===id);if(schedule){currentScheduleId=id;const modalTitle=document.getElementById('modalTitle');if(modalTitle)modalTitle.innerHTML='<i class="fas fa-edit"></i> Edit Schedule';document.getElementById('scheduleName').value=schedule.name;document.getElementById('channelId').value=schedule.channelId;document.getElementById('channelName').value=schedule.channelName||'';document.getElementById('message').value=schedule.message;document.getElementById('messageType').value=schedule.messageType||'text';document.getElementById('interval').value=schedule.interval;if(schedule.customInterval){document.getElementById('customInterval').value=schedule.customInterval}
if(schedule.specificTime&&schedule.specificTime.hour!==null){document.getElementById('hour').value=schedule.specificTime.hour;document.getElementById('minute').value=schedule.specificTime.minute||0}
if(schedule.mediaUrl){document.getElementById('mediaUrl').value=schedule.mediaUrl}
if(schedule.caption){document.getElementById('caption').value=schedule.caption}
if(schedule.pollQuestion){document.getElementById('pollQuestion').value=schedule.pollQuestion}
if(schedule.pollOptions&&schedule.pollOptions.length>0){document.getElementById('pollOptions').value=schedule.pollOptions.join(', ')}
if(schedule.buttons&&schedule.buttons.length>0){document.getElementById('buttons').value=JSON.stringify(schedule.buttons,null,2)}
if(schedule.endDate){const endDate=new Date(schedule.endDate);document.getElementById('endDate').value=endDate.toISOString().slice(0,16)}
if(schedule.maxSends){document.getElementById('maxSends').value=schedule.maxSends}
toggleIntervalOptions();toggleMessageType();const modal=document.getElementById('scheduleModal');if(modal)modal.style.display='flex'}}catch(error){console.error('Error loading schedule:',error);showNotification('Failed to load schedule details','error')}}
async function toggleSchedule(id){try{const response=await fetch(`${API_URL}/api/schedules/${id}/toggle`,{method:'PATCH',headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'}});if(response.ok){loadSchedules();showNotification('Schedule status updated','success')}else{showNotification('Failed to toggle schedule','error')}}catch(error){console.error('Error toggling schedule:',error);showNotification('Failed to toggle schedule','error')}}
async function deleteSchedule(id){if(!confirm('⚠️ Are you sure you want to delete this schedule? This action cannot be undone.'))return;try{const response=await fetch(`${API_URL}/api/schedules/${id}`,{method:'DELETE',headers:{'Authorization':`Bearer ${token}`}});if(response.ok){loadSchedules();showNotification('Schedule deleted successfully','success')}else{showNotification('Failed to delete schedule','error')}}catch(error){console.error('Error deleting schedule:',error);showNotification('Failed to delete schedule','error')}}
function toggleIntervalOptions(){const intervalSelect=document.getElementById('interval');if(!intervalSelect)return;const interval=intervalSelect.value;const customGroup=document.getElementById('customIntervalGroup');const timeGroup=document.getElementById('timeGroup');if(customGroup)customGroup.style.display=interval==='custom'?'block':'none';if(timeGroup)timeGroup.style.display=(interval==='daily'||interval==='weekly')?'block':'none'}
function toggleMessageType(){const typeSelect=document.getElementById('messageType');if(!typeSelect)return;const type=typeSelect.value;const mediaGroup=document.getElementById('mediaGroup');const pollGroup=document.getElementById('pollGroup');if(mediaGroup)mediaGroup.style.display=(type==='photo'||type==='video')?'block':'none';if(pollGroup)pollGroup.style.display=(type==='poll')?'block':'none'}
function closeModal(){const modal=document.getElementById('scheduleModal');if(modal)modal.style.display='none';currentScheduleId=null}
function showNotification(message,type){const notification=document.createElement('div');notification.style.cssText=`
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 24px;
        background: ${type === 'success' ? '#48bb78' : '#f56565'};
        color: white;
        border-radius: 8px;
        z-index: 9999;
        animation: slideIn 0.3s ease;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;notification.innerHTML=`<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;document.body.appendChild(notification);setTimeout(()=>{notification.style.animation='slideOut 0.3s ease';setTimeout(()=>notification.remove(),300)},3000)}
const style=document.createElement('style');style.textContent=`
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;document.head.appendChild(style);const scheduleForm=document.getElementById('scheduleForm');if(scheduleForm){scheduleForm.addEventListener('submit',async(e)=>{e.preventDefault();const scheduleData={name:document.getElementById('scheduleName').value.trim(),channelId:document.getElementById('channelId').value.trim(),channelName:document.getElementById('channelName').value.trim(),message:document.getElementById('message').value.trim(),messageType:document.getElementById('messageType').value,interval:document.getElementById('interval').value,endDate:document.getElementById('endDate').value||null,maxSends:document.getElementById('maxSends').value?parseInt(document.getElementById('maxSends').value):null};if(!scheduleData.name){showNotification('Schedule name is required','error');return}
if(!scheduleData.channelId){showNotification('Channel ID is required','error');return}
if(!scheduleData.message&&scheduleData.messageType==='text'){showNotification('Message is required','error');return}
if(scheduleData.messageType==='photo'||scheduleData.messageType==='video'){scheduleData.mediaUrl=document.getElementById('mediaUrl').value.trim();scheduleData.caption=document.getElementById('caption').value.trim();if(!scheduleData.mediaUrl){showNotification('Media URL is required for photo/video messages','error');return}}
if(scheduleData.messageType==='poll'){scheduleData.pollQuestion=document.getElementById('pollQuestion').value.trim();const pollOptionsText=document.getElementById('pollOptions').value;scheduleData.pollOptions=pollOptionsText.split(',').map(opt=>opt.trim()).filter(opt=>opt);if(!scheduleData.pollQuestion||scheduleData.pollOptions.length<2){showNotification('Poll requires a question and at least 2 options','error');return}}
const buttonsText=document.getElementById('buttons').value;if(buttonsText&&buttonsText.trim()){try{scheduleData.buttons=JSON.parse(buttonsText);if(!Array.isArray(scheduleData.buttons)){throw new Error('Buttons must be an array')}
for(const button of scheduleData.buttons){if(!button.text)throw new Error('Button text is required');if(button.type==='url'&&!button.url)throw new Error('URL button requires URL');if(button.type==='inline'&&!button.callbackData)throw new Error('Inline button requires callbackData');}}catch(e){showNotification('Invalid buttons JSON format: '+e.message,'error');return}}
if(scheduleData.interval==='custom'){scheduleData.customInterval=parseInt(document.getElementById('customInterval').value);if(!scheduleData.customInterval||scheduleData.customInterval<1||scheduleData.customInterval>43200){showNotification('Custom interval must be between 1 and 43200 minutes (30 days)','error');return}}
if(scheduleData.interval==='daily'||scheduleData.interval==='weekly'){const hour=parseInt(document.getElementById('hour').value);const minute=parseInt(document.getElementById('minute').value);if(isNaN(hour)||isNaN(minute)||hour<0||hour>23||minute<0||minute>59){showNotification('Please enter valid time (hour: 0-23, minute: 0-59)','error');return}
scheduleData.specificTime={hour,minute}}
try{const url=currentScheduleId?`${API_URL}/api/schedules/${currentScheduleId}`:`${API_URL}/api/schedules`;const method=currentScheduleId?'PUT':'POST';const response=await fetch(url,{method:method,headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(scheduleData)});if(response.ok){closeModal();loadSchedules();showNotification(currentScheduleId?'Schedule updated successfully':'Schedule created successfully','success')}else{const error=await response.json();showNotification(error.error||'Failed to save schedule','error')}}catch(error){console.error('Error saving schedule:',error);showNotification('Failed to save schedule','error')}})}
function logout(){if(confirm('Are you sure you want to logout?')){localStorage.removeItem('token');localStorage.removeItem('username');window.location.href='/login'}}
function escapeHtml(text){if(!text)return'';const div=document.createElement('div');div.textContent=text;return div.innerHTML}
if(window.location.pathname==='/dashboard'){loadSchedules()}
window.onclick=function(event){const modal=document.getElementById('scheduleModal');if(event.target===modal){closeModal()}}
document.addEventListener('keydown',function(event){if(event.key==='Escape'){closeModal()}});window.toggleSidebar=toggleSidebar;window.showTab=showTab;window.showCreateForm=showCreateForm;window.editSchedule=editSchedule;window.toggleSchedule=toggleSchedule;window.deleteSchedule=deleteSchedule;window.toggleIntervalOptions=toggleIntervalOptions;window.toggleMessageType=toggleMessageType;window.closeModal=closeModal;window.logout=logout
