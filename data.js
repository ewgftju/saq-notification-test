export const users = [
  {id:'reviewer',name:'А. Садыков',role:'Согласующий',org:'Контролирующий орган',initials:'АС'},
  {id:'author',name:'Д. Омаров',role:'Аудитор · инициатор',org:'ДВГА · отдел аудита',initials:'ДО'},
  {id:'director',name:'М. Алимова',role:'Утверждающий',org:'Руководитель органа',initials:'МА'},
  {id:'region',name:'А. Серикова',role:'Специалист по перечню',org:'ДВГА · Атырауская область',initials:'АС'},
  {id:'analyst',name:'Н. Тлеубеков',role:'Аналитик СУР · координатор',org:'СУР · центральный аппарат',initials:'НТ'},
  {id:'subject',name:'К. Мусина',role:'Представитель объекта аудита',org:'КГУ «Учебный центр»',initials:'КМ'},
  {id:'profsubject',name:'Е. Нурланов',role:'Представитель субъекта контроля',org:'ТОО «Аудит Пример»',initials:'ЕН'},
  {id:'quality',name:'С. Ахметова',role:'Эксперт контроля качества',org:'Управление КК',initials:'СА'},
  {id:'commission',name:'Б. Исаев',role:'Член комиссии',org:'Апелляционная комиссия',initials:'БИ'},
  {id:'secretary',name:'Р. Асанова',role:'Исполнитель рабочего органа',org:'Рассмотрение возражений',initials:'РА'},
  {id:'saq-demo-superuser',name:'Демо-суперпользователь',role:'Все действия · демо',org:'SAQ · демо',initials:'СУ'},
];

// All people, identifiers and organisations in this prototype are fictional.
export function makeSeed(now = new Date()) {
  const base = new Date(now);
  const at = (hours) => new Date(base.getTime() + hours * 3600000).toISOString();
  const date = (hours) => new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Almaty',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(at(hours)));
  const entities = [];
  const tasks = [];
  const notifications = [];
  const add = ({id,module,title,number,organization='КГУ «Учебный центр»',authorId='author',recipientId='reviewer',action='approve',category='approval',subject,body,hours=-1,dueHours=24,status='pending',content,relatedModule,version='1',extra={},task=true}) => {
    const taskId = task ? `task-${id}` : null;
    entities.push({id,module,title,number,organization,authorId,version,status:status==='pending'?'В работе':'Завершено',
      allowedUserIds:[...new Set([authorId,recipientId,...(extra.allowedUserIds || [])])],
      content:content || 'Документ подготовлен по материалам мероприятия. Проверьте содержание, состав приложений и соответствие выбранной редакции перед принятием решения.',
      history:[{at:at(hours),actorId:authorId,text:'Документ направлен адресату'}], ...extra,
      allowedUserIds:[...new Set([authorId,recipientId,...(extra.allowedUserIds || [])])]});
    if(task) tasks.push({id:taskId,entityId:id,recipientId,authorId,action,status,createdAt:at(hours),dueAt:dueHours===null?null:at(dueHours),version,routeId:`route-${id}`,step:0});
    notifications.push({id:`notice-${id}`,eventId:`event-${id}`,recipientId,actorId:authorId,module,category,entityId:id,taskId,version,
      title:subject || 'Согласуйте документ',body:body || `${title} № ${number}. ${organization}.`,createdAt:at(hours),readAt:hours < -20 ? at(hours+1) : null,relatedModule});
  };

  add({id:'program',module:'evga',title:'Программа аудита',number:'ВГА-2026-041',subject:'Согласуйте программу аудита',hours:-0.2,dueHours:8,
    content:'Аудит использования бюджетных средств на развитие учебной инфраструктуры. Проверяемый период: 2025–2026 годы. Вопросы: планирование расходов, исполнение договоров и учёт приобретённого оборудования.',extra:{allowedUserIds:['director']}});
  tasks.push({id:'task-program-final',entityId:'program',recipientId:'director',authorId:'author',action:'approve-final',status:'waiting',createdAt:at(-0.2),dueAt:at(48),version:'1',routeId:'route-program',step:1});
  add({id:'prof-package',module:'prof',title:'Пакет № 1 для ЕРСОП',number:'ПК-2026-018',organization:'ТОО «Аудит Пример»',subject:'Согласуйте пакет для ЕРСОП',hours:-0.6,dueHours:24,
    content:'Состав пакета: акт о назначении, форма 1-П, требования проверочного листа и пояснительная записка. На согласование направлен весь комплект одной редакции.'});
  add({id:'obj-request',module:'objections',title:'Запрос материалов',number:'ВОЗ-2026-027',authorId:'secretary',subject:'Согласуйте запрос по возражению',hours:-1.5,dueHours:-2,relatedModule:'evga',
    content:'Запрос в ДВГА о представлении мотивированной позиции по пунктам 2 и 4 аудиторского отчёта. Обращение связано с мероприятием ВГА-2026-041.'});
  add({id:'sva-conclusion',module:'sva',title:'Сводное заключение КК СВА',number:'КК-СВА-2026-012',authorId:'quality',subject:'Согласуйте заключение КК СВА',hours:-3,dueHours:48,
    content:'Контроль качества материалов мероприятия СВА. Рассмотрены документы и выводы аудита. Порядок КК СВА сохраняется в собственном модуле.'});
  add({id:'sur-ready',module:'sur',title:'Результаты рассмотрения СУР',number:'СУР-2026-009',authorId:'analyst',category:'result',task:false,subject:'Результаты СУР рассмотрены',body:'Отбор для ВГА · Атырауская область: 3 объекта включено, 2 исключено. Решения с обоснованиями доступны в своде.',hours:-6,status:'completed',content:'Свод результатов рассмотрения регионального отбора. Итоговый перечень формирует назначенный ответственный после завершения всех обязательных согласований.'});
  add({id:'finished-program',module:'evga',title:'План аудита',number:'ВГА-2026-036',authorId:'director',category:'result',task:false,subject:'План аудита утверждён',body:'Маршрут по плану аудита № ВГА-2026-036 завершён. Документ доступен в утверждённой редакции.',hours:-25,status:'completed'});
  add({id:'obsolete',module:'evga',title:'Программа аудита',number:'ВГА-2026-039',subject:'Задание по документу отменено',category:'result',hours:-29,status:'cancelled',content:'Инициатор отозвал редакцию 1 для уточнения состава объектов. Прежнее согласование отменено.',extra:{status:'Отозвано'}});
  add({id:'author-revision',module:'evga',title:'Аудиторский отчёт',number:'ВГА-2026-033',recipientId:'author',authorId:'reviewer',action:'revise',category:'revision',subject:'Отчёт возвращён на доработку',body:'Уточните обоснование по пункту 3 и приложите подтверждающие материалы. Комментарий: А. Садыков.',hours:-2,dueHours:30,
    content:'Замечание согласующего: по пункту 3 требуется связь вывода с подтверждающими материалами. После доработки создаётся новая редакция и новый маршрут согласования.'});
  add({id:'appeal-result',module:'objections',title:'Решение по возражению',number:'ВОЗ-2026-021',recipientId:'author',authorId:'secretary',action:'review',category:'review',subject:'Учтите результат рассмотрения возражения',body:'Возражение удовлетворено частично. Требуется рассмотреть последствия для пункта 4 аудиторского отчёта № ВГА-2026-028.',relatedModule:'evga',hours:-4,dueHours:48,
    content:'Возражение по пункту 4 удовлетворено частично. Ответственный исходного мероприятия рассматривает решение и запускает предусмотренное изменение документа. Уведомление само не изменяет аудиторский отчёт.'});
  add({id:'subject-answer',module:'evga',title:'Ответ о принятых мерах',number:'ОТВ-2026-016',recipientId:'author',authorId:'subject',action:'review',category:'review',subject:'Рассмотрите ответ объекта',body:'КГУ «Учебный центр» направило ответ по пунктам 1 и 2 предписания с подтверждающими материалами.',hours:-7,dueHours:40});
  add({id:'sur-selection',module:'sur',title:'Результаты СУР для формирования перечня ВГА',number:'СУР-2026-010',organization:'ДВГА · Атырауская область',authorId:'analyst',recipientId:'region',action:'review-selection',category:'review',subject:'Рассмотрите результаты СУР',body:'Отбор на 2027 год: 5 объектов по Атырауской области. Определите, какие объекты включить в итоговый перечень.',hours:-0.5,dueHours:72,
    content:'Результаты оценки рисков направлены на рассмотрение. По каждому объекту укажите решение. Для исключения обязательно основание. Исходная выгрузка СУР сохраняется.',
    extra:{kind:'selection',period:'2027',region:'Атырауская область',items:[
      {id:'o1',name:'Управление образования (пример)',risk:'Высокий',include:true,reason:''},
      {id:'o2',name:'Управление строительства (пример)',risk:'Высокий',include:true,reason:''},
      {id:'o3',name:'Центр спортивной подготовки (пример)',risk:'Средний',include:true,reason:''},
      {id:'o4',name:'Учебный центр (пример)',risk:'Средний',include:true,reason:''},
      {id:'o5',name:'Управление культуры (пример)',risk:'Средний',include:true,reason:''},
    ]}});
  notifications.push({id:'notice-sur-sent',eventId:'event-sur-sent',recipientId:'analyst',actorId:'analyst',module:'sur',category:'result',entityId:'sur-selection',taskId:null,version:'1',title:'Результаты СУР направлены',body:'Пакет № СУР-2026-010 направлен специалисту по перечню Атырауской области. Ожидается результат рассмотрения.',createdAt:at(-0.5),readAt:null});
  add({id:'audit-report',module:'evga',title:'Аудиторский отчёт',number:'АО-2026-041',recipientId:'subject',action:'acknowledge',category:'acknowledge',subject:'Ознакомьтесь с аудиторским отчётом',hours:-1,dueHours:48,content:'Подписанная редакция аудиторского отчёта по КГУ «Учебный центр». Доступны результаты аудита и приложения. Ознакомление фиксируется отдельным действием представителя организации.'});
  add({id:'audit-request',module:'evga',title:'Требование о представлении сведений',number:'ТР-2026-017',recipientId:'subject',action:'respond',category:'execution',subject:'Предоставьте сведения по требованию',hours:-4,dueHours:20,content:'Представьте сведения об исполнении договоров за проверяемый период. Ответ поступит назначенному аудитору для рассмотрения.'});
  for (const [id,title,number] of [['prof-act','Акт о назначении профилактического контроля','ПК-2026-019'],['prof-checklist','Проверочный лист','ПЛ-2026-019']])
    add({id,module:'prof',title,number,organization:'ТОО «Аудит Пример»',recipientId:'profsubject',action:'acknowledge',category:'acknowledge',subject:`Ознакомьтесь: ${title.toLowerCase()}`,hours:-1,dueHours:48,content:'Документ направлен субъекту профилактического контроля. Ознакомление с этой редакцией подтверждается отдельно от других документов комплекта.'});
  add({id:'prof-prescription',module:'prof',title:'Предписание об устранении нарушений',number:'ПР-2026-014',organization:'ТОО «Аудит Пример»',recipientId:'profsubject',action:'respond',category:'execution',subject:'Представьте ответ по предписанию',hours:-28,dueHours:50,content:'Представьте информацию об исполнении пункта 1 предписания. Прикрепление настоящих документов и юридически значимая отправка в этом макете не выполняются.'});
  add({id:'quality-materials',module:'evga',title:'Материалы для контроля качества',number:'КК-2026-022',authorId:'reviewer',recipientId:'quality',action:'review',category:'review',subject:'Вам назначен контроль качества',hours:-1,dueHours:72,content:'Комплект документов подготовительного этапа. Назначенному эксперту требуется изучить материалы и оформить заключение в модуле ВГА.'});
  add({id:'meeting',module:'objections',title:'Заседание апелляционной комиссии',number:'АК-2026-012',authorId:'secretary',recipientId:'commission',action:'attendance',category:'meeting',subject:'Подтвердите участие в заседании',body:`Заседание АК-2026-012 · ${date(48)}, 15:00 (Астана). В повестке 3 обращения.`,hours:-1,dueHours:24,
    content:`Заседание запланировано на ${date(48)} в 15:00 (Астана). Формат: видеоконференция. В повестке три обращения. Ответ о присутствии фиксируется отдельно от прочтения уведомления.`});
  add({id:'commission-position',module:'objections',title:'Материалы обращения для комиссии',number:'ВОЗ-2026-027-К',authorId:'secretary',recipientId:'commission',action:'review',category:'review',subject:'Представьте позицию по обращению',hours:-6,dueHours:36,content:'Изучите материалы обращения и представьте позицию по оспариваемым пунктам. Решение комиссии принимается в установленном процессе заседания.'});
  add({id:'obj-answer',module:'objections',title:'Ответ ДВГА на запрос',number:'ВОЗ-2026-022',authorId:'author',recipientId:'secretary',action:'review',category:'review',subject:'Поступил ответ ДВГА',hours:-2,dueHours:24,content:'ДВГА направил мотивированную позицию и материалы по обращению. Рассмотрите полноту ответа для подготовки материалов комиссии.'});
  notifications.push({id:'notice-reminder',eventId:'reminder-obj-request',recipientId:'reviewer',actorId:'system',module:'objections',category:'deadline',entityId:'obj-request',taskId:'task-obj-request',version:'1',title:'Срок согласования запроса истёк',body:'Запрос № ВОЗ-2026-027 ожидает вашего решения. Поручение остаётся открытым.',createdAt:at(-0.05),readAt:null});
  return ensureDemoHistory({schemaVersion:1,createdAt:base.toISOString(),activeUserId:'reviewer',entities,tasks,notifications,preferences:{}, sequence:1});
}

// Add fictional completed documents so pagination is visible without creating
// extra assignments. Existing reads and decisions are preserved.
export function ensureDemoHistory(state) {
  state.preferences ||= {};
  if(state.preferences.demoHistoryVersion===1)return state;
  const examples=[
    ['evga','План аудита','ВГА','План аудита утверждён','director','Утверждённая редакция плана доступна для просмотра.'],
    ['prof','Пакет для ЕРСОП','ПК','Пакет для ЕРСОП согласован','author','Согласование комплекта завершено. Итоговая редакция сохранена.'],
    ['objections','Решение по возражению','ВОЗ','Рассмотрение возражения завершено','secretary','Решение комиссии и протокол приложены к материалам обращения.'],
    ['sur','Результаты рассмотрения СУР','СУР','Результаты СУР рассмотрены','analyst','Регион завершил отбор. Решения о включении и исключении объектов доступны в своде.'],
    ['sva','Заключение контроля качества СВА','КК-СВА','Заключение КК СВА согласовано','quality','Согласованное заключение сохранено в составе материалов контроля качества.'],
  ];
  for(let i=0;i<32;i++){
    const [module,title,prefix,subject,actorId,message]=examples[i%examples.length];
    const id=`demo-history-${String(i+1).padStart(2,'0')}`,number=`${prefix}-2026-${String(100+i).padStart(3,'0')}`;
    const createdAt=new Date(new Date(state.createdAt).getTime()-(36+i*7)*3600000).toISOString();
    if(!state.entities.some(e=>e.id===id))state.entities.push({id,module,title,number,organization:'КГУ «Учебный центр»',authorId:actorId,version:'1',status:'Завершено',allowedUserIds:['reviewer',actorId],content:`${message} Демонстрационный документ из истории уведомлений.`,history:[{at:createdAt,actorId,text:subject}]});
    if(!state.notifications.some(n=>n.id===`notice-${id}`))state.notifications.push({id:`notice-${id}`,eventId:`event-${id}`,recipientId:'reviewer',actorId,module,category:'result',entityId:id,taskId:null,version:'1',title:subject,body:`${title} № ${number}. ${message}`,createdAt,readAt:i<14?null:createdAt});
  }
  state.preferences.demoHistoryVersion=1;
  return state;
}
