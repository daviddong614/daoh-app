
        // 用户登录状态
        let isLoggedIn = false;
        let isGuest = true;  // 默认游客模式
        let userName = '';
        let userAvatar = '👨';
        let selectedHobbies = [];
        let userPostCount = 0;
        let userViolations = 0;

        // ==================== Supabase 初始化 ====================
        const SUPABASE_URL = 'https://tsxrlwxleglqkfibddvl.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzeHJsd3hsZWdscWtmaWJkZHZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMDI1MzYsImV4cCI6MjA5NjU3ODUzNn0.7xz5qn8SmwkeOY67nEXUBFqQdAMPuOoby7S29eJBUKk';
        let sb = null;
        // 动态异步加载 Supabase SDK（不阻塞页面渲染和其他功能）
        (function loadSupabaseAsync() {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = function() {
                try {
                    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                    console.log('[Supabase] 初始化成功');
                } catch(e) {
                    console.warn('[Supabase] 客户端创建失败:', e.message);
                }
            };
            script.onerror = function() {
                console.warn('[Supabase] SDK加载失败，使用本地数据模式');
            };
            document.head.appendChild(script);
        })();

        // localStorage 兼容：仍用 localStorage 缓存当前登录用户昵称
        const CURRENT_USER_KEY = 'daohes_current_user';

        // 初始化：从 Supabase 恢复登录状态
        async function initUserData() {
            if (!sb) { console.warn('[initUserData] Supabase不可用，跳过'); return; }
            const currentUser = localStorage.getItem(CURRENT_USER_KEY);
            
            if (currentUser) {
                const { data, error } = await sb.from('users').select('*').eq('nickname', currentUser).single();
                if (data) {
                    isLoggedIn = true;
                    isGuest = false;
                    userName = currentUser;
                    userAvatar = data.avatar || '👨';
                    selectedHobbies = data.hobbies || [];
                    return true;
                } else {
                    // 本地缓存过期，清除
                    localStorage.removeItem(CURRENT_USER_KEY);
                }
            }
            return false;
        }

        // 注册新用户（写入 Supabase）
        async function registerUser(nickname, password) {
            if (!sb) { console.warn('Supabase不可用'); return null; }
            const { data, error } = await sb.from('users').insert([{
                nickname: nickname,
                password_hash: password,
                avatar: '👨',
                birthyear: '',
                hobbies: [],
                intro: '',
                province: ''
            }]).select().single();
            if (error) {
                console.error('注册失败:', error);
                return null;
            }
            localStorage.setItem(CURRENT_USER_KEY, nickname);
            return data;
        }

        // 验证用户登录（查询 Supabase）
        async function verifyUser(nickname, password) {
            if (!sb) { showToast('网络异常，请稍后重试'); return false; }
            const { data, error } = await sb.from('users').select('*').eq('nickname', nickname).eq('password_hash', password).single();
            if (data) {
                localStorage.setItem(CURRENT_USER_KEY, nickname);
                return true;
            }
            return false;
        }

        // 检查昵称是否已存在
        async function checkNicknameExists(nickname) {
            if (!sb) return false;
            const { data, error } = await sb.from('users').select('nickname').eq('nickname', nickname).single();
            return !!data;
        }

        // 更新当前用户数据
        async function updateCurrentUserData(data) {
            const currentUser = localStorage.getItem(CURRENT_USER_KEY);
            if (!currentUser) return false;
            
            if (!sb) return false;
            const { error } = await sb.from('users').update(data).eq('nickname', currentUser);
            return !error;
        }

        // 获取当前用户数据
        async function getCurrentUserData() {
            const currentUser = localStorage.getItem(CURRENT_USER_KEY);
            if (!currentUser) return null;
            
            if (!sb) return null;
            const { data, error } = await sb.from('users').select('*').eq('nickname', currentUser).single();
            return data || null;
        }

        // 退出登录
        function logout() {
            localStorage.removeItem(CURRENT_USER_KEY);
            isLoggedIn = false;
            isGuest = true;
            userName = '';
            userAvatar = '👨';
            selectedHobbies = [];
            showToast('已退出登录');
            
            // 更新UI
            updateLoggedInUI();
            updateGuestUI();
            
            // 返回首页
            showPage('home');
        }

        // 昵称+密码 登录/注册处理
        async function handleLoginOrRegister() {
            const nickname = document.getElementById('login-nickname').value.trim();
            const password = document.getElementById('login-password').value;
            
            if (!nickname) {
                showToast('请输入昵称');
                return;
            }
            
            if (nickname.length < 2) {
                showToast('昵称至少2个字符');
                return;
            }
            
            if (!password || password.length < 4) {
                showToast('密码至少4位');
                return;
            }
            
            const exists = await checkNicknameExists(nickname);
            
            if (exists) {
                // 用户已存在，验证密码
                const valid = await verifyUser(nickname, password);
                if (valid) {
                    // 登录成功
                    const userData = await getCurrentUserData();
                    userName = nickname;
                    userAvatar = userData?.avatar || '👨';
                    selectedHobbies = userData?.hobbies || [];
                    isLoggedIn = true;
                    isGuest = false;
                    
                    document.getElementById('login-page').style.display = 'none';
                    updateLoggedInUI();
                    updateGuestUI();
                    showToast(`欢迎回来，${userName}！`);
                } else {
                    showToast('密码错误');
                }
            } else {
                // 新用户，自动注册
                const newUser = await registerUser(nickname, password);
                if (!newUser) {
                    showToast('注册失败，请重试');
                    return;
                }
                userName = nickname;
                userAvatar = newUser.avatar || '👨';
                selectedHobbies = newUser.hobbies || [];
                isLoggedIn = true;
                isGuest = false;
                
                document.getElementById('login-page').style.display = 'none';
                updateLoggedInUI();
                updateGuestUI();
                showToast(`注册成功，欢迎，${userName}！`);
                
                // 首次注册后弹出完善信息弹窗
                setTimeout(() => {
                    document.getElementById('profile-modal').classList.add('active');
                    document.getElementById('profile-nickname').value = nickname;
                    document.getElementById('profile-nickname').readOnly = true;
                }, 500);
            }
        }

        // 更新已登录状态UI
        function updateLoggedInUI() {
            const homeUserAvatar = document.getElementById('home-user-avatar');
            const homeUserName = document.getElementById('home-user-name');
            const homeUserDesc = document.getElementById('home-user-desc');
            const verifyBtn = document.querySelector('.user-welcome-btn');
            
            if (isLoggedIn && !isGuest) {
                if (homeUserAvatar) homeUserAvatar.textContent = userAvatar;
                if (homeUserName) homeUserName.textContent = userName;
                if (homeUserDesc) homeUserDesc.textContent = '志同道合，一路同行';
                if (verifyBtn) verifyBtn.textContent = '我的 →';
            }
        }

        // 首页新功能相关变量
        let selectedAgeRange = null;
        let currentBroNickname = '';

        
        // ==================== 应用初始化 ====================
        
        // 页面加载时初始化
        async function initApp() {
            // 尝试从 Supabase 恢复登录状态
            const hasSession = await initUserData();
            
            if (hasSession) {
                // 有已保存的会话，隐藏登录页，恢复UI
                document.getElementById('login-page').style.display = 'none';
                updateLoggedInUI();
                updateGuestUI();
                console.log('已恢复会话:', userName);
            } else {
                // 没有会话，保持游客模式（登录页默认显示）
                updateGuestUI();
            }

            // 从 Supabase 加载帖子数据
            await loadPostsFromDB();
            // 从 Supabase 加载树洞数据
            await loadTreeholePostsFromDB();
        }

        // [initApp 已整合到第二个 DOMContentLoaded 中]

        // ==================== Supabase 数据加载 ====================
        
        // 从 Supabase 加载帖子数据，替换硬编码
        async function loadPostsFromDB() {
            if (!sb) { console.warn('[loadPostsFromDB] Supabase不可用，使用本地数据'); return; }
            try {
                const { data, error } = await sb
                    .from('posts')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(100);

                if (error) {
                    console.error('加载帖子失败:', error);
                    return;
                }

                if (data && data.length > 0) {
                    // 按 category 分组写入 posts 对象
                    const categoryMap = {
                        'fishing': 'fishing', 'tea': 'tea', 'collecting': 'collecting',
                        'wine': 'wine', 'chess': 'chess', 'health': 'health',
                        'photo': 'photo', 'car': 'car', 'history': 'history', 'fitness': 'fitness'
                    };
                    
                    // 清空现有 posts
                    for (const key in posts) {
                        if (posts.hasOwnProperty(key)) {
                            posts[key] = [];
                        }
                    }

                    console.log('[loadPostsFromDB] 开始填充数据，共', data.length, '条帖子');
                    data.forEach(post => {
                        const cat = categoryMap[post.category] || post.category;
                        if (!cat || !posts.hasOwnProperty(cat)) {
                            console.warn('[loadPostsFromDB] 帖子分类无效:', post.category, '->', cat, '帖子ID:', post.id);
                            return; // 跳过无效分类的帖子
                        }
                        if (posts[cat].length === 0) {
                            console.log('[loadPostsFromDB] 帖子ID:', post.id, '分类:', cat, '标题:', (post.title || '').substring(0, 30));
                        }
                        posts[cat].push({
                            id: post.id,
                            author: post.author_nickname,
                            avatar: post.author_avatar || '👨',
                            title: post.title,
                            content: post.content,
                            images: post.images || [],
                            likes: post.likes_count || 0,
                            comments: post.comments_count || 0,
                            time: formatTimeAgo(post.created_at),
                            tag: post.tag || '',
                            _dbId: post.id  // 保留数据库ID用于后续操作
                        });
                    });
                    
                    // 统计各板块帖子数量
                    console.log('[loadPostsFromDB] 数据填充完成，各板块帖子数:');
                    for (const [key, arr] of Object.entries(posts)) {
                        if (arr.length > 0) console.log('  ', key, ':', arr.length, '条');
                    }
                }
            } catch (e) {
                console.error('loadPostsFromDB 异常:', e);
            }
        }

        // 时间格式化：将 ISO 时间转为"XX前"
        function formatTimeAgo(isoTime) {
            if (!isoTime) return '刚刚';
            const now = new Date();
            const time = new Date(isoTime);
            const diff = Math.floor((now - time) / 1000);
            
            if (diff < 60) return '刚刚';
            if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
            if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
            if (diff < 604800) return Math.floor(diff / 86400) + '天前';
            return Math.floor(diff / 604800) + '周前';
        }

        // 加载帖子评论（帖子详情页用）
        async function loadCommentsFromDB(postId) {
            if (!sb) return [];
            const { data, error } = await sb
                .from('comments')
                .select('*')
                .eq('post_id', postId)
                .order('created_at', { ascending: true });
            
            if (error) {
                console.error('加载评论失败:', error);
                return [];
            }
            return (data || []).map(c => ({
                id: c.id,
                author: c.author_nickname,
                avatar: c.author_avatar || '👨',
                content: c.content,
                time: formatTimeAgo(c.created_at)
            }));
        }

        // 检查当前用户是否已点赞某帖
        async function checkUserLiked(postId) {
            if (!isLoggedIn || isGuest) return false;
            // Supabase 不可用时检查 localStorage
            if (!sb) {
                const likeKey = 'daoh_likes_' + userName;
                const likes = JSON.parse(localStorage.getItem(likeKey) || '{}');
                return !!likes[postId];
            }
            const { data } = await sb.from('likes')
                .select('id')
                .eq('user_nickname', userName)
                .eq('post_id', postId)
                .single();
            return !!data;
        }

        // 从 Supabase 加载树洞数据
        async function loadTreeholeFromDB() {
            if (!sb) return [];
            const { data, error } = await sb
                .from('treehole_posts')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);
            
            if (error || !data) return [];
            return data;
        }

        // 加载树洞数据并替换硬编码
        async function loadTreeholePostsFromDB() {
            try {
                const data = await loadTreeholeFromDB();
                if (data && data.length > 0) {
                    // 清空硬编码数据，替换为数据库数据
                    treeholePosts.length = 0;
                    data.forEach(post => {
                        treeholePosts.push({
                            id: post.id,
                            author: post.anonymous_name || '夜行人#????',
                            tag: post.tag || 'free',
                            content: post.content,
                            time: formatTimeAgo(post.created_at),
                            warms: post.warms_count || 0,
                            hugs: post.hugs_count || 0,
                            baseWarms: post.warms_count || 0,
                            baseHugs: post.hugs_count || 0,
                            comments: post.comments_count || 0
                        });
                    });
                    // 同步 localStorage 中的评论数
                    const allComments = JSON.parse(localStorage.getItem('treeholeComments') || '{}');
                    treeholePosts.forEach(p => {
                        const postId = String(p.id);
                        if (allComments[postId]) {
                            p.comments = allComments[postId].length;
                        }
                        // 同步点赞/抱抱状态到显示值
                        if (warmedPosts.has(postId) || warmedPosts.has(p.id)) {
                            p.warms = p.baseWarms + 1;
                        }
                        if (huggedPosts.has(postId) || huggedPosts.has(p.id)) {
                            p.hugs = p.baseHugs + 1;
                        }
                    });
                    renderTreeholeFull();
                }
            } catch (e) {
                console.error('加载树洞数据失败:', e);
            }
        }

        // 心情记录写入 Supabase
        async function saveMoodToDB(mood, note) {
            if (!isLoggedIn || isGuest || !sb) return false;
            const { error } = await sb.from('moods').insert([{
                user_nickname: userName,
                mood: mood,
                note: note || ''
            }]);
            return !error;
        }

// 励志金句数据
        const goldenQuotes = [
            { text: '人到中年，才明白什么叫做责任，什么叫做担当。', footer: '— 致每一个扛起家的你' },
            { text: '有些路，走着走着就剩自己了。但回头看看，家人就在身后。', footer: '— 致每一个默默坚持的你' },
            { text: '中年人的崩溃，往往就在一瞬间。但撑过去，天就亮了。', footer: '— 致每一个咬牙坚持的你' },
            { text: '不要总想着改变世界，能守护好身边的人就很了不起了。', footer: '— 致每一个平凡而伟大的你' },
            { text: '累了就歇歇，明天太阳还会升起。', footer: '— 致每一个努力生活的你' },
            { text: '男人可以不流泪，但不能没有担当。', footer: '— 致每一个扛起家庭重担的你' },
            { text: '有时候沉默不是懦弱，而是在思考怎么撑起这个家。', footer: '— 致每一个默默承受的你' },
            { text: '岁月是把杀猪刀，但也是一把磨刀石。', footer: '— 致每一个历经风雨的你' },
            { text: '不忘初心，方得始终。走再远，也别忘了为什么出发。', footer: '— 致每一个不忘初心的你' },
            { text: '兄弟，一路走来辛苦了。但你做得很好。', footer: '— 致每一个在路上的你' }
        ];

        // 今日话题数据
        const todayTopics = [
            '你觉得什么是真正的成功？',
            '中年以后，你最在乎的是什么？',
            '如果有时光机，你最想回到哪一年？',
            '你有多久没有为自己活过了？',
            '有没有一个人，让你觉得这辈子值了？',
            '你最想对孩子说的一句话是什么？',
            '如果明天退休了，你最想做什么？',
            '哪一刻让你觉得自己真的成熟了？',
            '有没有一句一直想说但没说出口的话？',
            '如果能重来，你会做出不同的选择吗？'
        ];

        // 敏感词库
        const sensitiveWords = [
            '傻逼', '妈逼', '操你妈', '去死', '杀全家', '傻X', '妈X', '脑残', '白痴',
            '人渣', '废物', '垃圾', '智障', '蠢货', '贱人', '婊子', '操蛋', '尼玛',
            '草泥马', '他妈的', '日你妈', '操你爸', '孙子', '狗日', '扑街', '二货',
            '色情', '淫秽', '黄色', 'av', '做爱', '性交', 'SM', '露骨',
            '赌博', '六合彩', '彩票', '时时彩', '博彩', '赌场', '网赌',
            '毒品', '冰毒', '海洛因', '大麻', '摇头丸', '吸毒', '贩毒',
            '暴力', '杀人', '绑架', '爆炸', '恐怖', '自杀', '砍杀', '枪杀'
        ];

        // 树洞匿名身份词库
        const anonymousNames = ['夜行人', '独行者', '守夜人', '夜归人', '静默者', '观心人', '拾星者', '听风者'];
        let currentAnonymousName = '';
        let currentTreeholeTag = '';
        let currentFilterTag = 'all';
        let currentReportTarget = null;
        let selectedReportReason = null;
        let treeholeFilterAuthor = false;

        // 过来人说数据
        const veteranPosts = [
            { id: 1, title: '45岁被裁员，我是怎么扛过来的', excerpt: '那段时间每天装作去上班，其实在车里坐到中午才回家。三个月后终于想通了自己到底要什么。', author: '老周', time: '2年前', warms: 2345, comments: 456 },
            { id: 2, title: '父亲查出癌症那天，我在医院走廊站了很久', excerpt: '从那一刻起，中年人的责任就真实地压在了肩上。好在发现得早，现在恢复得不错。', author: '行者', time: '1年前', warms: 1890, comments: 234 },
            { id: 3, title: '孩子高考那一年，我瘦了15斤', excerpt: '比孩子还紧张，每天陪读到半夜。现在回想那段时间，虽然累，但很值得。', author: '李工', time: '3年前', warms: 1567, comments: 189 },
            { id: 4, title: '离婚后第一个春节，一个人包了饺子', excerpt: '那天电视里放着春晚，我吃着饺子，突然觉得一个人也挺好的。', author: '沉默', time: '2年前', warms: 2345, comments: 567 },
            { id: 5, title: '40岁开始跑步，现在半马2小时', excerpt: '从跑1公里就喘，到现在能完赛半马。改变的不是身体，是整个人的状态。', author: '阿强', time: '5年前', warms: 3456, comments: 678 }
        ];

        // 每日一问数据（30+个问题）
        const dailyQuestions = [
            '你最近一次觉得累是什么时候？',
            '如果回到十年前，最想对当时的自己说什么？',
            '上一次跟老朋友喝酒，是什么时候了？',
            '孩子长大了，你最想告诉他什么？',
            '有没有一个决定，至今想起来还是会叹气？',
            '你上一次觉得活着真好，是什么时候？',
            '中年以后，你最怕什么？',
            '有没有一句话，你从来没对任何人说过？',
            '你最怀念的，是哪段时光？',
            '如果给自己现在的状态打个分，你打几分？',
            '最累的时候，你会怎么熬过去？',
            '有没有一个人，你一直想见但没去见？',
            '你上一次哭是什么时候？因为什么？',
            '如果现在财务自由了，你想做什么？',
            '你有多久没有好好睡一觉了？',
            '有没有一件事，做完之后觉得"这就是我"？',
            '你觉得自己是哪种父亲/丈夫/儿子？',
            '有没有一个遗憾，到现在还没释怀？',
            '什么时候你觉得自己真的成熟了？',
            '如果生命只剩一年，你会怎么过？',
            '你有多久没有为自己的梦想努力了？',
            '有没有一个人，让你觉得"这辈子值了"？',
            '你最不想让家人知道的事情是什么？',
            '什么时候你觉得孤独，但不想说话？',
            '有没有一句歌词，每次听到都会触动你？',
            '你最想回到哪一年？为什么？',
            '如果能重来，你会做出不同的选择吗？',
            '你上一次觉得被理解，是什么时候？',
            '你有多久没有好好吃过一顿饭了？',
            '有没有一句话，支撑你走过了最难的日子？'
        ];

        let currentQuestion = '';
        let questionAnswers = [];

        // 获取今日问题
        function getTodayQuestion() {
            const today = new Date();
            const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
            const index = dayOfYear % dailyQuestions.length;
            return dailyQuestions[index];
        }

        // 数据 - 板块名称改为有温度的名字
        const categories = [
            { id: 'fishing', name: '钓鱼', icon: '🎣', desc: '水边一坐，烦恼全消', posts: 12580 },
            { id: 'tea', name: '品茶', icon: '🍵', desc: '一杯茶，一段慢时光', posts: 9860 },
            { id: 'collecting', name: '文玩盘串', icon: '📿', desc: '盘的是串，磨的是性子', posts: 8540 },
            { id: 'wine', name: '酒文化', icon: '🍷', desc: '走，喝两杯', posts: 11200 },
            { id: 'chess', name: '棋牌', icon: '🀄', desc: '打牌最爽就是听牌那一下', posts: 7800 },
            { id: 'health', name: '养生', icon: '🧘', desc: '人过中年，守住根本', posts: 15600 },
            { id: 'photo', name: '摄影', icon: '📷', desc: '捕捉光影，定格时光', posts: 9200 },
            { id: 'car', name: '汽车自驾', icon: '🚗', desc: '追风的男人', posts: 22900 },
            { id: 'history', name: '历史军事', icon: '📚', desc: '聊历史，就着酒，才有味道', posts: 6900 },
            { id: 'fitness', name: '运动健身', icon: '🏃', desc: '人过中年，得有副铁骨', posts: 11800 }
        ];

        const hotTopics = [
            { title: '各位老哥，你们钓过最大的鱼是多少斤？', views: '23.5万', comments: 1842, category: 'fishing', categoryLabel: '钓鱼' },
            { title: '推荐一款适合中年人的口粮茶', views: '18.2万', comments: 956, category: 'tea', categoryLabel: '品茶' },
            { title: '刚提了辆坦克500，来说说用车感受', views: '15.8万', comments: 2103, category: 'car', categoryLabel: '汽车自驾' },
            { title: '每天晨跑5公里，坚持一年了', views: '12.4万', comments: 1567, category: 'fitness', categoryLabel: '运动健身' },
            { title: '入手了一串小叶紫檀，请各位掌眼', views: '9.7万', comments: 823, category: 'collecting', categoryLabel: '文玩盘串' }
        ];

        const treeholePosts = [
            { id: 1, author: '夜行人#3782', tag: 'midlife', content: '今年45了，上有老下有小。白天在外拼事业，晚上回家还得辅导孩子作业。有时候真想找个没人的地方躲一躲，但回头看看家人，又觉得自己必须撑下去。男人嘛，就是这么累。', time: '2小时前', warms: 328, hugs: 45, comments: 89 },
            { id: 2, author: '独行者#1204', tag: 'work', content: '上个月公司裁员名单里有我。干了15年，说没就没了。现在每天早出晚归假装上班，其实就是在图书馆泡着。不知道该怎么跟老婆说，孩子们还以为爸爸很忙。', time: '5小时前', warms: 512, hugs: 128, comments: 156 },
            { id: 3, author: '守夜人#8831', tag: 'emotion', content: '今天是我离婚一周年。一个人过其实也挺好的，虽然有时候会觉得孤独。但比起那段互相折磨的日子，现在的日子反而清净。男人到中年，学会了与自己和解。', time: '8小时前', warms: 267, hugs: 89, comments: 45 },
            { id: 4, author: '观心人#5627', tag: 'health', content: '父亲前两天摔了一跤，住院了。看着病床上苍老的他，突然意识到自己也50了。时间过得真快，还没好好年轻过，就老了。', time: '12小时前', warms: 445, hugs: 67, comments: 78 },
            { id: 5, author: '拾星者#2019', tag: 'midlife', content: '有时候真的很累，不是身体累，是心累。上有老下有小，中间还有工作压力。男人不能诉苦，只能自己扛。但今天就想在这个没人认识我的地方说一句：我也好累啊。', time: '1天前', warms: 678, hugs: 234, comments: 198 },
            { id: 6, author: '夜归人#6743', tag: 'family', content: '儿子今年高考，分数只够上个普通本科。说不失望是假的，但更多的是担心他的未来。不知道该怎么开导他，只能默默陪着他。', time: '1天前', warms: 389, hugs: 56, comments: 67 },
            { id: 7, author: '听风者#3356', tag: 'work', content: '听说公司要搬迁到外地去，如果是真的就只能被迫换工作了。在这个年纪重新开始，想想就头大。各位老哥有没有类似的经历？', time: '1天前', warms: 234, hugs: 45, comments: 89, unverified: true },
            { id: 8, author: '静默者#9981', tag: 'health', content: '最近体检报告出来了，好几项指标都不太好。医生让注意休息，可是人到中年，哪有资格休息啊。老婆孩子还指着我呢。', time: '2天前', warms: 567, hugs: 123, comments: 134, disclaimer: true }
        ];

        // 为每条帖子保存原始计数（用于localStorage状态+原始数计算显示值）
        treeholePosts.forEach(p => { p.baseWarms = p.warms; p.baseHugs = p.hugs; });

        // 暖一下/抱抱状态（提前定义，确保数据加载时可引用）
        let warmedPosts = new Set(JSON.parse(localStorage.getItem('warmedPosts') || '[]'));
        let huggedPosts = new Set(JSON.parse(localStorage.getItem('huggedPosts') || '[]'));

        const treeholeTagNames = {
            work: '💼 工作压力',
            family: '👨‍👩‍👧 家庭关系',
            midlife: '🌅 中年危机',
            health: '💪 健康焦虑',
            emotion: '💔 情感困惑',
            free: '🌿 自由倾诉'
        };

        const posts = {
            fishing: [
                { id: 1, author: '老渔夫', avatar: '🎣', title: '分享一下我的野钓装备清单，都是实战经验', content: '玩野钓快20年了，这套装备是我这些年用下来最顺手的。鱼竿选的是达亿瓦的经典款，线组搭配4+3，主攻鲫鱼鲤鱼，偶尔也能搏一下草鱼。饵料方面，冬季用红虫，夏季用玉米和商品饵轮换。\n\n很多新手上来就买一堆装备，其实完全没必要。先把基础配置搞齐，等确定了自己的喜好再升级也不迟。', images: [{data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%232a2a30" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%236b6560" font-size="48" text-anchor="middle" dominant-baseline="middle"%3E🎣%3C/text%3E%3C/svg%3E'}, {data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%232a2a30" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%236b6560" font-size="48" text-anchor="middle" dominant-baseline="middle"%3E🌊%3C/text%3E%3C/svg%3E'}], likes: 328, comments: 86, time: '3小时前', tag: '装备分享' },
                { id: 2, author: '水库专业户', avatar: '🌊', title: '周末去水库守了两天，收获还行', content: '这次去的是老家那边的中型水库，提前打了窝，用的玉米打窝商品饵作钓。第一天空军，第二天终于开了张，上了两条草鱼，加起来快20斤。\n\n野钓就是这样，不可能每次都爆护，保持好心态最重要。现在这个季节鱼不太好钓，能有这收获已经很满足了。', images: [{data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%232a2a30" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%236b6560" font-size="48" text-anchor="middle" dominant-baseline="middle"%3E🐟%3C/text%3E%3C/svg%3E'}], likes: 256, comments: 54, time: '6小时前', tag: '渔获分享' },
                { id: 3, author: '路亚发烧友', avatar: '🐟', title: '新手入门路亚，从这里开始少走弯路', content: '很多钓友想尝试路亚但不知道从何入手。我总结了几点经验供大家参考：\n\n1. 先选微物竿练手，不要一开始就买贵的\n2. 拟饵不用买太多，几种经典款够用\n3. 抛投技巧需要多练习，空军是常态\n4. 选择标点比装备更重要\n\n路亚的乐趣在于主动找鱼，这个过程比鱼获本身更有意思。', images: [{data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%232a2a30" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%236b6560" font-size="48" text-anchor="middle" dominant-baseline="middle"%3E🎯%3C/text%3E%3C/svg%3E'}, {data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%232a2a30" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%236b6560" font-size="48" text-anchor="middle" dominant-baseline="middle"%3E🏞️%3C/text%3E%3C/svg%3E'}], likes: 412, comments: 98, time: '1天前', tag: '经验分享' }
            ],
            tea: [
                { id: 1, author: '普洱客', avatar: '🍂', title: '存了8年的老班章，今天开了一饼', content: '2016年收的茶饼，当时价格还没涨这么厉害。这几年一直用紫砂罐存着，今天刚好有老友来访，就开了一起品。\n\n开汤之后枣香味很足，回甘明显，比新茶时期好喝太多了。存茶真的需要耐心，急不得。各位茶友有条件的可以适当存一些，好茶经得起时间考验。', images: [{data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%232a2a30" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%236b6560" font-size="48" text-anchor="middle" dominant-baseline="middle"%3E🍵%3C/text%3E%3C/svg%3E'}, {data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%232a2a30" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%236b6560" font-size="48" text-anchor="middle" dominant-baseline="middle"%3E🍂%3C/text%3E%3C/svg%3E'}], likes: 567, comments: 134, time: '5小时前', tag: '普洱茶' },
                { id: 2, author: '岩茶爱好者', avatar: '🏔️', title: '说说肉桂和水仙的区别，新手必看', content: '很多茶友分不清肉桂和水仙，我简单说一下个人理解：\n\n肉桂：香气霸道，以桂皮香为主，回甘快，适合喜欢浓烈口感的茶友\n水仙：滋味醇厚，以兰花香为主，口感绵柔，适合细品\n\n新手入门建议先从水仙喝起，慢慢过渡到肉桂。直接喝肉桂可能不太适应。', images: [{data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%232a2a30" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%236b6560" font-size="48" text-anchor="middle" dominant-baseline="middle"%3E🏔️%3C/text%3E%3C/svg%3E'}], likes: 423, comments: 87, time: '1天前', tag: '岩茶' }
            ],
            collecting: [
                { id: 1, author: '木器老炮', avatar: '🪵', title: '这串核桃盘了5年，玻璃底包浆', content: '2019年开始玩的四座楼，当时还是入门级价格。现在算下来也花了不小的心血，每天刷、盘、晒，每天至少2小时。\n\n看到现在的玻璃底包浆，觉得一切都值了。玩文玩最重要的就是耐心，急功近利反而容易糟蹋东西。', images: [{data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%232a2a30" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%236b6560" font-size="48" text-anchor="middle" dominant-baseline="middle"%3E🪵%3C/text%3E%3C/svg%3E'}, {data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%232a2a30" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%236b6560" font-size="48" text-anchor="middle" dominant-baseline="middle"%3E🌳%3C/text%3E%3C/svg%3E'}, {data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%232a2a30" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%236b6560" font-size="48" text-anchor="middle" dominant-baseline="middle"%3E✨%3C/text%3E%3C/svg%3E'}], likes: 892, comments: 156, time: '2小时前', tag: '核桃' },
                { id: 2, author: '星月玩家', avatar: '⭐', title: '海南籽和越南籽到底有什么区别？', content: '很多新手分不清海南籽和越南籽，我总结几点：\n\n1. 星月密度：海南籽密度更高\n2. 星点：海南籽星点更小更均匀\n3. 颜色：海南籽顺白更多\n4. 价格：越南籽便宜很多\n\n预算够的话建议直接上海南籽，一步到位。', images: [{data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%232a2a30" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%236b6560" font-size="48" text-anchor="middle" dominant-baseline="middle"%3E⭐%3C/text%3E%3C/svg%3E'}], likes: 345, comments: 67, time: '8小时前', tag: '星月菩提' }
            ],
            wine: [
                { id: 1, author: '红酒老炮', avatar: '🍷', title: '推荐几款性价比高的日常口粮酒', content: '中年男人总要喝点酒，我这些年的口粮酒推荐：\n\n1. 法国餐酒级别的波尔多，百元左右日常喝不心疼\n2. 智利的赤霞珠，果香足好入口\n3. 西班牙的里奥哈，性价比之王\n\n不建议买超市里太便宜的酒，那个质量真不行。稍微多花点钱，品质提升一大截。', images: [{data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%232a2a30" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%236b6560" font-size="48" text-anchor="middle" dominant-baseline="middle"%3E🍷%3C/text%3E%3C/svg%3E'}, {data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%232a2a30" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%236b6560" font-size="48" text-anchor="middle" dominant-baseline="middle"%3E🍇%3C/text%3E%3C/svg%3E'}], likes: 634, comments: 189, time: '4小时前', tag: '红酒' },
                { id: 2, author: '白酒达人', avatar: '🥃', title: '飞天茅台和五粮液，到底哪个好？', content: '这两个都是顶级酱香和浓香的代表，很难说谁更好。\n\n飞天茅台：酱香突出，空杯留香，回味悠长\n五粮液：窖香浓郁，口感绵甜，适口性更好\n\n我个人更喜欢五粮液，因为不用每次喝都那么正襟危坐。', images: [{data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%232a2a30" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%236b6560" font-size="48" text-anchor="middle" dominant-baseline="middle"%3E🥃%3C/text%3E%3C/svg%3E'}], likes: 456, comments: 234, time: '1天前', tag: '白酒' }
            ],
            chess: [
                { id: 1, author: '象棋高手', avatar: '♟️', title: '残局解析：这步棋暗藏玄机', content: '分享一个我研究了很久的残局。红方少子但有攻势，黑方多子但位置不好。关键在于红方第二步的炮二进三，这步棋很多业余棋友会忽略。\n\n有兴趣的可以摆出来研究一下，答案晚点公布。', images: [{data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%232a2a30" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%236b6560" font-size="48" text-anchor="middle" dominant-baseline="middle"%3E♟️%3C/text%3E%3C/svg%3E'}], likes: 234, comments: 78, time: '12小时前', tag: '象棋' }
            ],
            health: [
                { id: 1, author: '养生大叔', avatar: '🌿', title: '52岁，体检报告比40岁时还好', content: '分享下我的养生经验：\n\n1. 每天早起打太极或散步一小时\n2. 饮食清淡，少油少盐，多吃粗粮\n3. 戒酒三年，实在推不掉就喝一杯\n4. 保证7小时睡眠，22点前必睡\n5. 每年定期体检，有问题早发现\n\n50岁以后，身体就是最大的财富。年轻时欠下的健康债，迟早要还。', images: [{data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%232a2a30" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%236b6560" font-size="48" text-anchor="middle" dominant-baseline="middle"%3E🌿%3C/text%3E%3C/svg%3E'}], likes: 1234, comments: 345, time: '1小时前', tag: '养生心得' },
                { id: 2, author: '中医爱好者', avatar: '📜', title: '说说艾灸这段时间的感受', content: '坚持艾灸三个月了，主要灸关元、足三里、三阴交这几个穴位。说下感受：\n\n1. 睡眠质量确实有改善\n2. 手脚冰凉的情况少了\n3. 精神状态比之前好\n\n艾灸要注意通风，烟味有些人受不了。还有就是灸完要喝温水，不要碰冷水。', images: [], likes: 567, comments: 123, time: '2天前', tag: '中医养生' }
            ],
            photo: [
                { id: 1, author: '风光狗', avatar: '📷', title: '川西自驾，收获一组满意的片子', content: '这次去川西运气不错，赶上了好天气。设备是索尼A7R4+1635GM，光圈全开，ISO100-400。\n\n后期用LR简单调了一下，主要是还原细节和增加一点饱和度。数码时代的好处就是可以多拍，回来再慢慢选。', images: [{data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%232a2a30" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%236b6560" font-size="48" text-anchor="middle" dominant-baseline="middle"%3E🏔️%3C/text%3E%3C/svg%3E'}, {data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%232a2a30" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%236b6560" font-size="48" text-anchor="middle" dominant-baseline="middle"%3E🌅%3C/text%3E%3C/svg%3E'}, {data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%232a2a30" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%236b6560" font-size="48" text-anchor="middle" dominant-baseline="middle"%3E📷%3C/text%3E%3C/svg%3E'}], likes: 789, comments: 156, time: '6小时前', tag: '风光摄影' },
                { id: 2, author: '老法师', avatar: '🎨', title: '新手该买什么相机？给个实在建议', content: '很多朋友问我该买什么相机，我的建议是：\n\n1. 预算内的全画幅，画质和残幅差距明显\n2. 不要买套机头，单独买更划算\n3. 索尼/佳能/尼康都行，生态系统更重要\n4. 二手也可以考虑，省钱\n\n相机只是工具，好照片靠的是眼睛和脑子。', images: [{data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%232a2a30" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%236b6560" font-size="48" text-anchor="middle" dominant-baseline="middle"%3E📷%3C/text%3E%3C/svg%3E'}], likes: 456, comments: 234, time: '1天前', tag: '器材讨论' }
            ],
            car: [
                { id: 1, author: '自驾达人', avatar: '🚗', title: '新提的理想L8，两个月使用报告', content: '选这车主要是家用需求，6座适合我们这种二孩家庭。开了两个月，说说优缺点：\n\n优点：空间大、座椅舒服、智驾好用、能耗低\n缺点：悬架偏软、车身太大停车费劲、品牌积累不够\n\n总体来说满意，这个价位能给的都给了。', images: [{data: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%232a2a30%22 width=%22400%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 fill=%22%236b6560%22 font-size=%2248%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22%3E🚗%3C/text%3E%3C/svg%3E'}, {data: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%232a2a30%22 width=%22400%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 fill=%22%236b6560%22 font-size=%2248%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22%3E🏞️%3C/text%3E%3C/svg%3E'}], likes: 678, comments: 234, time: '3小时前', tag: '新能源' },
                { id: 2, author: '越野玩家', avatar: '🏜️', title: '穿越丙察察，这条路太刺激了', content: '终于完成了心心念念的丙察察穿越。全程虽然只有300多公里，但走了将近12个小时。\n\n非铺装路面炮弹坑多，对车辆和驾驶技术都是考验。建议3.0以上排量的四驱SUV去，两驱车还是算了。沿途风景确实美，但条件也确实是艰苦。', images: [{data: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%232a2a30%22 width=%22400%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 fill=%22%236b6560%22 font-size=%2248%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22%3E🏜️%3C/text%3E%3C/svg%3E'}, {data: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%232a2a30%22 width=%22400%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 fill=%22%236b6560%22 font-size=%2248%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22%3E🛣️%3C/text%3E%3C/svg%3E'}], likes: 892, comments: 167, time: '2天前', tag: '自驾游' },
                { id: 3, author: '摩旅老炮', avatar: '🏍️', title: '骑着GW250走了趟西藏，给想去的兄弟一些建议', content: '终于完成了心心念念的摩旅梦想，从成都出发走318到拉萨，再走滇藏线回来，全程8000多公里。\n\n几点建议：\n1. 排量250以上才够用，GW250勉强够但有点吃力\n2. 必备装备：头盔、护具、边箱、胎压监测\n3. 每天出发前检查车辆，这是保命的关键\n4. 高原反应不只是人的事，车也会"高反"\n\n最美的风景真的在路上，这种体验开汽车是完全不一样的。', images: [{data: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%232a2a30%22 width=%22400%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 fill=%22%236b6560%22 font-size=%2248%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22%3E🏍️%3C/text%3E%3C/svg%3E'}, {data: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%232a2a30%22 width=%22400%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 fill=%22%236b6560%22 font-size=%2248%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22%3E🗻%3C/text%3E%3C/svg%3E'}], likes: 1234, comments: 256, time: '5小时前', tag: '摩旅分享' },
                { id: 4, author: '骑行者', avatar: '🚴', title: '环青海湖骑行后，给中年人的一点忠告', content: '52岁完成环青海湖骑行，全程360公里，用了4天。\n\n说几点感受：\n1. 骑行服和坐垫真的很重要，不然骑到怀疑人生\n2. 每天保持80-100公里的节奏，不要逞强\n3. 高海拔骑行比想象中累，提前做好体能储备\n4. 带足补给，水和能量棒要多带\n\n这次骑行让我找回了年轻时的感觉，但也要量力而行。', images: [{data: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%232a2a30%22 width=%22400%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 fill=%22%236b6560%22 font-size=%2248%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22%3E🚴%3C/text%3E%3C/svg%3E'}], likes: 567, comments: 89, time: '1天前', tag: '骑行心得' },
                { id: 5, author: '机车少年', avatar: '🛵', title: '40岁才拿摩托车驾照，晚吗？', content: '很多人问我40岁才开始骑摩托是不是太晚了。我的回答是：一点都不晚！\n\n我是去年才拿的D照，现在骑着一辆CB400F。刚开始老婆强烈反对，现在她也被我带着考了驾照。\n\n中年人的机车梦，不该只是梦。有想法就去实现，人生没有太晚的开始。', images: [{data: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%232a2a30%22 width=%22400%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 fill=%22%236b6560%22 font-size=%2248%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22%3E🛵%3C/text%3E%3C/svg%3E'}], likes: 892, comments: 178, time: '2天前', tag: '新手入门' }
            ],
            history: [
                { id: 1, author: '历史研究者', avatar: '📚', title: '为什么说岳飞不是民族英雄？', content: '这个话题争议很大，我说说我的理解：\n\n从历史唯物主义角度看，岳飞抗金保护的是当时汉民族的利益，而金朝后来已经融入中华民族大家庭。所以从中华民族整体视角看，岳飞的"民族英雄"身份确实值得商榷。\n\n但从爱国主义精神传承角度，岳飞体现的忠义精神值得传承。这是两个层面的问题。', images: [], likes: 567, comments: 345, time: '5小时前', tag: '历史讨论' },
                { id: 2, author: '军事迷', avatar: '⚔️', title: '分析一下俄乌战争的走向', content: '这场战争打了快两年了，个人判断：\n\n1. 短期内不可能结束，双方都没有必胜能力\n2. 俄罗斯虽然体量大，但经济撑不住持久战\n3. 乌克兰靠西方援助，但援助力度在减弱\n4. 最终可能走向类似朝鲜战争的局面，停火不停战\n\n这场战争给我们最大的启示就是：和平真的太珍贵了。', images: [], likes: 432, comments: 267, time: '1天前', tag: '军事分析' }
            ],
            fitness: [
                { id: 1, author: '健身老炮', avatar: '💪', title: '48岁大叔，健身10年的变化', content: '从38岁开始健身，今年刚好第十年。身高178cm，当年190斤，现在155斤。体脂从30%降到18%。\n\n刚开始就是跑步+器械，后来慢慢系统化。到现在每周4次力量+2次有氧，风雨无阻。\n\n最大的收获不是身材变好了，而是整个人精神状态完全不同。以前爬个三楼都喘，现在爬山毫无压力。', images: [{data: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%232a2a30%22 width=%22400%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 fill=%22%236b6560%22 font-size=%2248%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22%3E💪%3C/text%3E%3C/svg%3E'}, {data: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%232a2a30%22 width=%22400%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 fill=%22%236b6560%22 font-size=%2248%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22%3E🏋️%3C/text%3E%3C/svg%3E'}], likes: 2345, comments: 456, time: '2小时前', tag: '健身故事' },
                { id: 2, author: '跑步爱好者', avatar: '🏃', title: '首马安全完赛，4小时32分', content: '42岁完成了人生第一个全程马拉松，成绩4小时32分，虽然不算快，但已经很满意了。\n\n准备了大半年，月跑量从80公里慢慢加到200公里。赛前减了跑量，调整状态。\n\n想告诉各位中年兄弟，马拉松没有想象中那么难，但也不简单。科学训练很重要，量力而行更重要。', images: [{data: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%232a2a30%22 width=%22400%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 fill=%22%236b6560%22 font-size=%2248%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22%3E🏃%3C/text%3E%3C/svg%3E'}], likes: 1234, comments: 289, time: '3天前', tag: '跑步' }
            ]
        };

        const activeUsers = [
            { name: '老张', desc: '钓鱼达人', posts: 1562 },
            { name: '王哥', desc: '健身达人', posts: 1234 },
            { name: '李师傅', desc: '品茶高手', posts: 987 },
            { name: '赵总', desc: '自驾老炮', posts: 856 },
            { name: '钱老板', desc: '文玩行家', posts: 743 }
        ];

        // 游客入口
        function enterAsGuest() {
            isGuest = true;
            document.getElementById('login-page').style.display = 'none';
            showToast('您已进入游客模式，可浏览但无法互动');
            updateGuestUI();
        }

        // [已废弃] handleVerifyClick 在后面有最终定义

        // 检查登录状态，如果未登录则提示
        function requireLogin() {
            if (isGuest || !isLoggedIn) {
                showToast('请先登录后再操作');
                document.getElementById('login-page').style.display = 'flex';
                return false;
            }
            return true;
        }

        // 关闭基本信息弹窗

        // 关闭基本信息弹窗
        function closeProfileModal() {
            document.getElementById('profile-modal').classList.remove('active');
        }

        // 兴趣爱好多选
        function toggleHobby(el) {
            const hobbyId = el.dataset.id;
            if (el.classList.contains('selected')) {
                el.classList.remove('selected');
                selectedHobbies = selectedHobbies.filter(h => h !== hobbyId);
            } else {
                el.classList.add('selected');
                selectedHobbies.push(hobbyId);
            }
        }

        // 头像选择
        function selectAvatar(el) {
            document.querySelectorAll('.avatar-option').forEach(a => a.classList.remove('selected'));
            el.classList.add('selected');
            userAvatar = el.dataset.avatar;
        }

        // 完成注册/完善资料
        async function completeProfile() {
            const nickname = document.getElementById('profile-nickname').value.trim();
            const birthYear = document.getElementById('profile-birthyear').value;
            const province = document.getElementById('profile-province').value;
            const bio = document.getElementById('profile-intro') ? document.getElementById('profile-intro').value : '';
            const covenantChecked = document.getElementById('covenant-agree') ? document.getElementById('covenant-agree').checked : false;
            
            console.log('completeProfile called', {nickname, birthYear, province, bio, covenantChecked});
            
            // 加个try-catch防止静默报错
            try {

            if (!nickname) {
                showToast('请输入您的昵称');
                return;
            }

            // 验证年龄（出生年份需在1990年及之前，即35岁以上）
            if (!birthYear) {
                showToast('请选择您的年代');
                return;
            }
            

            if (!province) {
                showToast('请选择您所在的省份');
                return;
            }

            if (!covenantChecked) {
                showToast('请阅读并同意社区公约');
                return;
            }

            // 获取选中的头像
            const selectedAvatar = document.querySelector('.avatar-option.selected');
            const selectedAvatarValue = selectedAvatar ? selectedAvatar.dataset.avatar : '👨';
            
            // 如果是已登录用户，更新 Supabase
            if (isLoggedIn && !isGuest) {
                await updateCurrentUserData({
                    avatar: selectedAvatarValue,
                    birthyear: birthYear,
                    province: province,
                    hobbies: selectedHobbies,
                    intro: bio
                });
                userAvatar = selectedAvatarValue;
            }
            
            // 如果是从登录页注册的新用户（昵称只读），更新 Supabase
            if (!isLoggedIn && !isGuest) {
                // 检查是否是只读昵称（登录页注册的用户）
                const nicknameInput = document.getElementById('profile-nickname');
                if (nicknameInput && nicknameInput.readOnly) {
                    await updateCurrentUserData({
                        avatar: selectedAvatarValue,
                        birthyear: birthYear,
                        province: province,
                        hobbies: selectedHobbies,
                        intro: bio
                    });
                    userAvatar = selectedAvatarValue;
                }
            }
            
            userName = nickname;
            document.getElementById('profile-modal').classList.remove('active');
            document.getElementById('login-page').style.display = 'none';
            isLoggedIn = true;
            isGuest = false;
            
            // 更新UI
            updateLoggedInUI();
            updateGuestUI();
            
            // 更新个人角落
            updateProfileCorner();
            
            // 如果当前在找兄弟页面，重新初始化
            if (document.getElementById('page-find-bro').classList.contains('active')) {
                initFindBroPage();
            }
            
            // 重置昵称输入框状态
            const nicknameInput = document.getElementById('profile-nickname');
            if (nicknameInput) {
                nicknameInput.readOnly = false;
            }
            
            showToast(`资料已保存，${userName}！`);
            } catch(e) { console.error('completeProfile error:', e); showToast('出错了：' + e.message); }
        }

        // 更新个人角落
        function updateProfileCorner() {
            document.getElementById('corner-nickname').textContent = userName;
            document.getElementById('profile-avatar').textContent = userAvatar;
            
            // 计算道行（随机1-5年）
            const daoYears = Math.floor(Math.random() * 5) + 1;
            document.getElementById('profile-dao').textContent = `${daoYears}年`;
            
            // 显示常驻板块
            const hobbiesContainer = document.getElementById('profile-hobbies');
            if (hobbiesContainer && selectedHobbies.length > 0) {
                hobbiesContainer.innerHTML = selectedHobbies.map(h => {
                    const cat = categories.find(c => c.id === h);
                    return cat ? `<span style="background: var(--tertiary-dark); padding: 6px 12px; border-radius: 20px; font-size: 13px;">${cat.icon} ${cat.name}</span>` : '';
                }).join('');
            } else if (hobbiesContainer) {
                hobbiesContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 14px;">还没选常驻板块</span>';
            }
        }

        // 显示个人角落页面
        function showProfileCorner() {
            updateProfileCorner();
            showPage('profile');
        }

        // 更新游客UI状态
        function updateGuestUI() {
            const guestBadge = document.getElementById('guest-badge');
            const loginGuideBar = document.getElementById('login-guide-bar');
            
            // 游客模式下显示提示
            if (guestBadge) {
                guestBadge.style.display = isGuest ? 'flex' : 'none';
            }
            if (loginGuideBar) {
                loginGuideBar.style.display = isGuest ? 'flex' : 'none';
            }
            
            // 更新首页用户欢迎条
            const homeUserAvatar = document.getElementById('home-user-avatar');
            const homeUserName = document.getElementById('home-user-name');
            const homeUserDesc = document.getElementById('home-user-desc');
            const verifyBtn = document.querySelector('.user-welcome-btn');
            
            if (isLoggedIn && !isGuest && userName) {
                // 已登录
                if (homeUserAvatar) homeUserAvatar.textContent = userAvatar;
                if (homeUserName) homeUserName.textContent = userName;
                if (homeUserDesc) homeUserDesc.textContent = '志同道合，一路同行';
                if (verifyBtn) verifyBtn.textContent = '我的 →';
            } else if (isGuest) {
                // 游客模式
                if (homeUserAvatar) homeUserAvatar.textContent = '👤';
                if (homeUserName) homeUserName.textContent = '游客';
                if (homeUserDesc) homeUserDesc.textContent = '登录后可参与互动';
                if (verifyBtn) verifyBtn.textContent = '立即认证 →';
            }
        }

        // 页面渲染
        function showPage(page) {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(`page-${page}`).classList.add('active');
            window.scrollTo(0, 0);
            
            // 如果切换到树洞页面，确保标题是最新的
            if (page === 'treehole') {
                const hour = new Date().getHours();
                const isDeepNight = hour >= 22 || hour < 6;
                updateTreeholePageTitle(isDeepNight);
            }
            
            // 如果切换到找兄弟页面，初始化页面状态
            if (page === 'find-bro') {
                initFindBroPage();
            }
        }

        function renderCategories() {
            const grid = document.getElementById('category-grid');
            if (!grid) return;
            grid.innerHTML = categories.map(cat => `
                <div class="category-card" onclick="showCategory('${cat.id}')">
                    <span class="category-icon">${cat.icon}</span>
                    <div class="category-name">${cat.name}</div>
                    <div class="category-count">${cat.posts.toLocaleString()} 帖</div>
                </div>
            `).join('');
        }

        function renderHotPosts() {
            const container = document.getElementById('hot-posts');
            const allPosts = Object.values(posts).flat().sort((a, b) => b.likes - a.likes).slice(0, 5);
            container.innerHTML = allPosts.map(post => `
                <div class="post-card" onclick="showPost('${post.id}', '')">
                    <div class="post-header">
                        <div class="post-avatar">${post.avatar}</div>
                        <div class="post-meta">
                            <div class="post-author">${post.author}</div>
                            <div class="post-time">${post.time}</div>
                        </div>
                        <span class="post-tag">${post.tag}</span>
                    </div>
                    <h3 class="post-title">${post.title}</h3>
                    <p class="post-excerpt">${post.content}</p>
                    ${post.images && post.images.length ? (() => {
                        const displayImages = post.images.slice(0, 9);
                        const cols = displayImages.length === 1 ? 1 : displayImages.length <= 3 ? 2 : displayImages.length <= 9 ? 3 : 2;
                        const imageUrls = displayImages.map(img => img.data || img);
                        return `<div class="post-images-grid cols-${cols}">
                            ${displayImages.map((img, idx) => {
                                const imgSrc = img.data || img;
                                const isVideo = img.type === 'video';
                                return isVideo 
                                    ? `<div class="post-video-item" onclick="event.stopPropagation(); openLightbox(['${imgSrc}'], ${idx})">
                                        <img src="${imgSrc}" alt="视频">
                                       </div>`
                                    : `<div class="post-image-item" onclick="event.stopPropagation(); openLightbox(${JSON.stringify(imageUrls)}, ${idx})">
                                        <img src="${imgSrc}" alt="图片">
                                       </div>`;
                            }).join('')}
                        </div>`;
                    })() : ''}
                    <div class="post-footer">
                        <div class="post-action"><span class="post-action-icon">👍</span> ${post.likes} 有共鸣</div>
                        <div class="post-action"><span class="post-action-icon">💬</span> ${post.comments} 评论</div>
                        <div class="post-action"><span class="post-action-icon">👁️</span> ${Math.floor(post.likes * 10)}</div>
                    </div>
                </div>
            `).join('');
        }

        function renderHotTopics() {
            const topicsHtml = hotTopics.map((topic, i) => `
                <div class="hot-topic" onclick="openHotTopic(${i})" style="cursor:pointer;">
                    <div class="hot-rank ${i < 3 ? 'top' : ''}">${i + 1}</div>
                    <div class="hot-content">
                        <div class="hot-title">${topic.title}</div>
                        <div class="hot-meta">${topic.views} 阅读 · ${topic.comments} 评论</div>
                    </div>
                </div>
            `).join('');
            
            // 渲染到侧边栏（桌面端）
            const container = document.getElementById('hot-topics');
            if (container) container.innerHTML = topicsHtml;
            
            // 渲染到移动端区域
            const mobileContainer = document.getElementById('mobile-hot-topics');
            if (mobileContainer) {
                mobileContainer.innerHTML = `
                    <div class="sidebar-card">
                        <h3 class="sidebar-title">🔥 热议话题</h3>
                        ${topicsHtml}
                    </div>
                `;
            }
        }

        function openHotTopic(index) {
            try {
                const topic = hotTopics[index];
                if (!topic) {
                    showToast('话题不存在，index=' + index);
                    return;
                }
                
                // 调试信息
                console.log('[openHotTopic] index:', index, 'topic:', topic.title, 'category:', topic.category);
                
                // If there's a matching category, navigate to it
                if (topic.category) {
                    showCategory(topic.category);
                    // Show a toast about the topic
                    showToast('进入「' + (topic.categoryLabel || '') + '」板块');
                } else {
                // Show topic in a modal
                const modal = document.createElement('div');
                modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:center;justify-content:center;';
                modal.onclick = function(e) { if(e.target === modal) document.body.removeChild(modal); };
                
                modal.innerHTML = `
                    <div style="background:#1a1a1f;border-radius:16px;padding:24px;max-width:400px;width:90%;position:relative;">
                        <button onclick="document.body.removeChild(this.parentElement.parentElement)" style="position:absolute;top:12px;right:12px;background:none;border:none;color:#999;font-size:24px;cursor:pointer;">×</button>
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
                            <span style="background:#e74c3c;color:#fff;padding:4px 8px;border-radius:4px;font-size:12px;font-weight:bold;">热</span>
                            <span style="color:#888;font-size:13px;">${topic.views} 阅读</span>
                        </div>
                        <h3 style="color:#fff;font-size:18px;margin:0 0 16px 0;line-height:1.4;">${topic.title}</h3>
                        <div style="background:#2a2a30;border-radius:8px;padding:16px;margin-bottom:16px;">
                            <div style="color:#888;font-size:13px;margin-bottom:8px;">💬 ${topic.comments} 条讨论</div>
                            <div style="color:#ccc;font-size:14px;line-height:1.6;">这个话题正在热烈讨论中，快来分享你的看法吧！</div>
                        </div>
                        <button onclick="document.body.removeChild(this.parentElement.parentElement); openPostModal();" style="width:100%;padding:12px;background:linear-gradient(135deg,#5b7fc7,#4a6ba5);color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer;">参与讨论</button>
                    </div>
                `;
                
                document.body.appendChild(modal);
                }
            } catch(e) {
                console.error('openHotTopic error:', e);
                showToast('出错了：' + e.message);
            }
        }

        function renderActiveUsers() {
            const container = document.getElementById('active-users');
            container.innerHTML = activeUsers.map(user => `
                <div class="hot-topic">
                    <div class="hot-rank">🏆</div>
                    <div class="hot-content">
                        <div class="hot-title">${user.name}</div>
                        <div class="hot-meta">${user.desc} · ${user.posts} 帖</div>
                    </div>
                </div>
            `).join('');
        }

        // 首页树洞预览已改为入口卡片，此函数保留为空占位
        function renderTreeholePreview_placeholder() {
            // 首页不需要预览了，已改为入口卡片
        }

        function renderTreeholeFull() {
            const container = document.getElementById('treehole-full');
            let filteredPosts = currentFilterTag === 'all' 
                ? treeholePosts 
                : treeholePosts.filter(p => p.tag === currentFilterTag);
            
            if (filteredPosts.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">🌙</div>
                        <div class="empty-text">这里还安静，你先说吧</div>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = filteredPosts.map(post => `
                <div class="treehole-card" data-id="${post.id}" data-author="${post.author}" onclick="handleTreeholeCardClick(event, '${post.id}')">
                    <div class="treehole-anonymous">
                        <div class="anonymous-avatar">👤</div>
                        <span class="anonymous-tag">${post.author}</span>
                        <span class="treehole-card-tag">${treeholeTagNames[post.tag] || '自由倾诉'}</span>
                        <span class="anonymous-time">${post.time}</span>
                    </div>
                    ${post.unverified ? '<div class="audit-warning" style="margin-bottom: 10px;">⚠️ 该内容未经证实，请理性看待</div>' : ''}
                    ${post.disclaimer ? '<div class="disclaimer-badge">⚠️ 以上内容仅为个人观点，不构成专业建议</div>' : ''}
                    <p class="treehole-content">${post.content}</p>
                    <div class="treehole-footer" onclick="event.stopPropagation()">
                        <button class="treehole-warm-btn ${isWarmed(post.id) ? 'active' : ''}" onclick="toggleWarm(this, '${post.id}')">
                            <span>🔥</span> <span>${post.warms}</span>
                        </button>
                        <button class="treehole-hug-btn ${isHugged(post.id) ? 'active' : ''}" onclick="toggleHug(this, '${post.id}')">
                            <span>🤗</span> <span>${post.hugs}</span>
                        </button>
                        <div class="post-action" onclick="toggleTreeholeComments('${post.id}')"><span class="post-action-icon">💬</span> <span class="th-comment-count">${post.comments}</span></div>
                        <button class="report-btn" onclick="openReportModal('treehole', '${post.id}')">不妥</button>
                    </div>
                </div>
            `).join('');
        }

        function isWarmed(id) { return warmedPosts.has(String(id)) || warmedPosts.has(id); }
        function isHugged(id) { return huggedPosts.has(String(id)) || huggedPosts.has(id); }

        function toggleWarm(btn, id) {
            if (!isLoggedIn) { alert('登录后才能暖一下'); return; }
            const post = treeholePosts.find(p => String(p.id) === String(id));
            if (!post) return;
            const base = post.baseWarms !== undefined ? post.baseWarms : post.warms;
            if (warmedPosts.has(id)) {
                warmedPosts.delete(id);
            } else {
                warmedPosts.add(id);
            }
            post.warms = warmedPosts.has(id) ? base + 1 : base;
            localStorage.setItem('warmedPosts', JSON.stringify([...warmedPosts]));
            renderTreeholeFull();
        }

        function toggleHug(btn, id) {
            if (!isLoggedIn) { alert('登录后才能抱抱'); return; }
            const post = treeholePosts.find(p => String(p.id) === String(id));
            if (!post) return;
            const base = post.baseHugs !== undefined ? post.baseHugs : post.hugs;
            if (huggedPosts.has(id)) {
                huggedPosts.delete(id);
            } else {
                huggedPosts.add(id);
            }
            post.hugs = huggedPosts.has(id) ? base + 1 : base;
            localStorage.setItem('huggedPosts', JSON.stringify([...huggedPosts]));
            renderTreeholeFull();
        }

        // ========== 树洞评论功能 ==========
        // 从 localStorage 加载树洞评论
        function getTreeholeComments(postId) {
            const all = JSON.parse(localStorage.getItem('treeholeComments') || '{}');
            return all[postId] || [];
        }

        function saveTreeholeComments(postId, comments) {
            const all = JSON.parse(localStorage.getItem('treeholeComments') || '{}');
            all[postId] = comments;
            localStorage.setItem('treeholeComments', JSON.stringify(all));
        }

        function toggleTreeholeComments(postId) {
            // 找到对应的 treehole-card
            const card = document.querySelector(`.treehole-card[data-id="${postId}"]`);
            if (!card) return;

            // 检查是否已经展开了评论区
            let section = card.querySelector('.treehole-comment-section');
            if (section) {
                section.remove();
                return;
            }

            // 创建评论区
            section = document.createElement('div');
            section.className = 'treehole-comment-section';

            const comments = getTreeholeComments(postId);
            
            let commentListHtml = '';
            if (comments.length === 0) {
                commentListHtml = '<div class="treehole-no-comments">暂无评论，来说两句吧</div>';
            } else {
                commentListHtml = '<div class="treehole-comment-list">';
                comments.forEach(c => {
                    commentListHtml += `
                        <div class="treehole-comment-item">
                            <span class="treehole-comment-avatar">${c.avatar || '👨'}</span>
                            <div class="treehole-comment-body">
                                <div class="treehole-comment-author">${c.author}</div>
                                <div class="treehole-comment-text">${c.content}</div>
                                <div class="treehole-comment-time">${c.time}</div>
                            </div>
                        </div>
                    `;
                });
                commentListHtml += '</div>';
            }

            section.innerHTML = `
                ${commentListHtml}
                <div class="treehole-comment-input-wrap">
                    <input type="text" class="treehole-comment-input" placeholder="说点什么..." id="th-input-${postId}" maxlength="200" onkeydown="if(event.key==='Enter')submitTreeholeComment('${postId}')">
                    <button class="treehole-comment-submit" onclick="submitTreeholeComment('${postId}')">发送</button>
                </div>
            `;

            card.appendChild(section);
            
            // 聚焦输入框
            setTimeout(() => {
                const input = document.getElementById(`th-input-${postId}`);
                if (input) input.focus();
            }, 100);
        }

        // 点击树洞卡片内容区域展开评论
        function handleTreeholeCardClick(event, postId) {
            // 如果点击的是按钮或输入框等交互元素，不触发
            if (event.target.closest('button') || event.target.closest('input') || event.target.closest('.treehole-footer') || event.target.closest('.treehole-comment-section')) {
                return;
            }
            toggleTreeholeComments(postId);
        }

        function submitTreeholeComment(postId) {
            if (!isLoggedIn) { alert('登录后才能评论'); return; }
            
            const input = document.getElementById(`th-input-${postId}`);
            if (!input) return;
            
            const text = input.value.trim();
            if (!text) return;

            // 敏感词过滤
            const hasSensitive = sensitiveWords.some(w => text.includes(w));
            if (hasSensitive) { alert('评论包含不当内容，请修改后重试'); return; }

            const comment = {
                author: userName,
                avatar: userAvatar || '👨',
                content: text,
                time: '刚刚'
            };

            // 保存到 localStorage
            const comments = getTreeholeComments(postId);
            comments.push(comment);
            saveTreeholeComments(postId, comments);

            // 更新本地帖子评论计数
            const post = treeholePosts.find(p => p.id === postId);
            if (post) {
                post.comments = comments.length;
            }

            // 更新显示上的评论数
            const card = document.querySelector(`.treehole-card[data-id="${postId}"]`);
            if (card) {
                const countSpan = card.querySelector('.th-comment-count');
                if (countSpan && post) {
                    countSpan.textContent = post.comments;
                }
            }

            // 重新渲染评论区
            const section = card ? card.querySelector('.treehole-comment-section') : null;
            if (section) section.remove();
            toggleTreeholeComments(postId);
        }

                // 分类标签筛选
        function filterTreeholeTag(btn, tag) {
            document.querySelectorAll('.treehole-tag-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilterTag = tag;
            renderTreeholeFull();
        }

        function showCategory(catId) {
            console.log('[showCategory] 被调用，catId:', catId);
            const category = categories.find(c => c.id === catId);
            if (!category) {
                console.error('[showCategory] 找不到板块:', catId);
                showToast('找不到该板块');
                return;
            }
            const catPosts = posts[catId] || [];
            console.log('[showCategory] 板块:', category.name, '帖子数:', catPosts.length);
            if (catPosts.length > 0) {
                console.log('[showCategory] 第一条帖子:', catPosts[0].title?.substring(0, 30));
            }
            
            document.getElementById('category-detail').innerHTML = `
                <div class="back-btn" onclick="showPage('home')">
                    <span>←</span> 返回首页
                </div>
                <div class="category-header">
                    <div class="category-header-icon">${category.icon}</div>
                    <div class="category-header-info">
                        <h1>${category.name}</h1>
                        <p>${category.desc}</p>
                    </div>
                    <div class="category-header-stats">
                        <div class="category-stat">
                            <div class="category-stat-value">${category.posts.toLocaleString()}</div>
                            <div class="category-stat-label">帖子</div>
                        </div>
                        <div class="category-stat">
                            <div class="category-stat-value">${Math.floor(category.posts * 0.8).toLocaleString()}</div>
                            <div class="category-stat-label">互动</div>
                        </div>
                    </div>
                </div>
                <div class="post-list">
                    ${catPosts.length ? catPosts.map(post => `
                        <div class="post-card" onclick="showPostDetail('${post.id}', '${catId}')">
                            <div class="post-header">
                                <div class="post-avatar">${post.avatar}</div>
                                <div class="post-meta">
                                    <div class="post-author">${post.author}</div>
                                    <div class="post-time">${post.time}</div>
                                </div>
                                <span class="post-tag">${post.tag}</span>
                            </div>
                            <h3 class="post-title">${post.title}</h3>
                            <p class="post-excerpt">${post.content}</p>
                            ${post.images && post.images.length ? (() => {
                                const displayImages = post.images.slice(0, 9);
                                const cols = displayImages.length === 1 ? 1 : displayImages.length <= 3 ? 2 : 3;
                                const imageUrls = displayImages.map(img => img.data || img);
                                return `<div class="post-images-grid cols-${cols}">
                                    ${displayImages.map((img, idx) => {
                                        const imgSrc = img.data || img;
                                        const isVideo = img.type === 'video';
                                        return isVideo 
                                            ? `<div class="post-video-item" onclick="event.stopPropagation(); openLightbox(['${imgSrc}'], ${idx})">
                                                <img src="${imgSrc}" alt="视频">
                                               </div>`
                                            : `<div class="post-image-item" onclick="event.stopPropagation(); openLightbox(${JSON.stringify(imageUrls)}, ${idx})">
                                                <img src="${imgSrc}" alt="图片">
                                               </div>`;
                                    }).join('')}
                                </div>`;
                            })() : ''}
                            <div class="post-footer">
                                <div class="post-action"><span class="post-action-icon">👍</span> ${post.likes} 有共鸣</div>
                                <div class="post-action"><span class="post-action-icon">💬</span> ${post.comments} 评论</div>
                            </div>
                        </div>
                    `).join('') : '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">这里还安静，你来写第一笔</div></div>'}
                </div>
            `;
            
            showPage('category');
        }

        function getCategoryByPostId(postId, preferredCat) {
            // 优先检查指定板块（避免跨板块ID重复匹配错误）
            if (preferredCat && posts[preferredCat]) {
                if (posts[preferredCat].find(p => p.id == postId)) return preferredCat;
            }
            for (const [catId, catPosts] of Object.entries(posts)) {
                if (catPosts.find(p => p.id == postId)) return catId;
            }
            return 'fishing';
        }

        function showPost(postId, catId) {
            // 先尝试指定板块，否则遍历所有板块找帖子
            if (catId) {
                const catPosts = posts[catId] || [];
                const post = catPosts.find(p => p.id == postId);
                if (post) { showPostDetail(postId, catId); return; }
            }
            // 未指定板块或指定板块没找到，遍历所有板块
            for (const [cid, catPosts] of Object.entries(posts)) {
                const post = catPosts.find(p => String(p.id) === String(postId));
                if (post) { showPostDetail(postId, cid); return; }
            }
            showToast('帖子不存在');
        }

        async function showPostDetail(postId, catId) {
            const catPosts = posts[catId] || [];
            const post = catPosts.find(p => p.id == postId);
            if (!post) return;

            // 从 Supabase 加载评论（sb 不可用时跳过）
            let comments = [];
            if (sb) {
                try {
                    const { data, error } = await sb
                        .from('comments')
                        .select('*')
                        .eq('post_id', postId)
                        .order('created_at', { ascending: true });
                    if (!error && data) {
                        comments = data.map(c => ({
                            author: c.author_nickname || '匿名',
                            avatar: c.author_avatar || '👤',
                            text: c.content,
                            time: formatTimeAgo(c.created_at),
                            images: c.images || []
                        }));
                    }
                } catch(e) {
                    console.error('加载评论失败:', e);
                }
            }

            document.getElementById('post-detail').innerHTML = `
                <div class="post-detail">
                    <div class="back-btn" onclick="showCategory('${catId}')">
                        <span>←</span> 返回${categories.find(c => c.id === catId)?.name || '板块'}
                    </div>
                    <div class="detail-card">
                        <div class="detail-header">
                            <div class="detail-avatar">${post.avatar}</div>
                            <div class="detail-author-info">
                                <div class="detail-author-name">${post.author}</div>
                                <div class="detail-meta">${post.time} · ${post.tag}</div>
                            </div>
                        </div>
                        <h1 class="detail-title">${post.title}</h1>
                        <div class="detail-content">
                            ${post.content.split('\n').map(p => `<p>${p}</p>`).join('')}
                        </div>
                        ${post.images && post.images.length ? `
                            ${(() => {
                                const cols = post.images.length === 1 ? 1 : post.images.length <= 3 ? 2 : 3;
                                const imageUrls = post.images.map(img => img.data || img);
                                return `<div class="detail-images-grid cols-${cols}">
                                    ${post.images.map((img, idx) => {
                                        const imgSrc = img.data || img;
                                        return `<div class="detail-image-item" onclick="openLightbox(${JSON.stringify(imageUrls)}, ${idx})">
                                            <img src="${imgSrc}" alt="图片${idx + 1}">
                                        </div>`;
                                    }).join('')}
                                </div>`;
                            })()}
                        ` : ''}
                        ${post.unverified ? '<div class="audit-warning">⚠️ 该内容未经证实，请理性看待</div>' : ''}
                        ${post.disclaimer ? '<div class="disclaimer-badge">⚠️ 以上内容仅为个人观点，不构成专业建议</div>' : ''}
                        <div class="detail-actions">
                            <div class="detail-action" onclick="toggleLike(this, '${post.id}')"><span>👍</span> <span>${post.likes}</span></div>
                            <div class="detail-action"><span>💬</span> <span>${post.comments}</span></div>
                            <div class="detail-action"><span>📤</span> 分享</div>
                            <div class="detail-action"><span>⭐</span> 记下了</div>
                            <button class="report-btn" onclick="openReportModal('post', '${postId}')">不妥</button>
                        </div>
                    </div>
                    
                    <div class="comments-section">
                        <h3 class="comments-title">评论 (${comments.length})</h3>
                        <div class="comment-input-wrapper">
                            <div class="comment-input-row">
                                <label class="comment-img-btn" onclick="document.getElementById('comment-file-${postId}').click()">📷</label>
                                <input type="file" id="comment-file-${postId}" accept="image/*" multiple style="display: none;" onchange="handleCommentImgUpload('${postId}', this)">
                                <input type="text" class="comment-input" placeholder="也说两句……" id="comment-input-${postId}">
                                <button class="comment-send" onclick="submitComment('${postId}')">➤</button>
                            </div>
                        </div>
                        <div class="comment-list">
                            ${comments.map((c, i) => `
                                <div class="comment-item">
                                    <div class="comment-avatar">${c.avatar}</div>
                                    <div class="comment-content">
                                        <div class="comment-author">${c.author}</div>
                                        <div class="comment-text">${c.text}</div>
                                        ${c.images && c.images.length ? `
                                            <div class="comment-images">
                                                ${c.images.map(img => `
                                                    <div class="comment-image-thumb" onclick="openLightbox(['${img}'], 0)">
                                                        <img src="${img}" alt="评论图片">
                                                    </div>
                                                `).join('')}
                                            </div>
                                        ` : ''}
                                        <div class="comment-actions">
                                            <span class="comment-time">${c.time}</span>
                                            <span class="comment-reply">回复</span>
                                            <span class="comment-reply">赞</span>
                                            <button class="report-btn" onclick="openReportModal('comment', ${i})">举报</button>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
            
            showPage('post');
        }

        // 弹窗控制
        function openPostModal() {
            // 检查登录状态
            if (isGuest || !isLoggedIn) {
                showToast('请先登录后再发帖');
                document.getElementById('login-page').style.display = 'flex';
                return;
            }
            document.getElementById('post-modal').classList.add('active');
        }

        function closePostModal() {
            document.getElementById('post-modal').classList.remove('active');
            document.getElementById('post-category').value = '';
            document.getElementById('post-title').value = '';
            document.getElementById('post-content').value = '';
            document.getElementById('upload-preview').innerHTML = '';
        }

        function openTreeholeModal() {
            document.getElementById('treehole-modal').classList.add('active');
        }

        function closeTreeholeModal() {
            document.getElementById('treehole-modal').classList.remove('active');
            document.getElementById('treehole-content').value = '';
        }

        // 增强版树洞发布弹窗
        function openTreeholePostModal() {
            // 检查登录状态
            if (isGuest || !isLoggedIn) {
                showToast('请先登录后再发帖');
                document.getElementById('login-page').style.display = 'flex';
                return;
            }
            currentAnonymousName = generateAnonymousName();
            document.getElementById('anonymous-name').textContent = currentAnonymousName;
            document.getElementById('treehole-post-content').value = '';
            currentTreeholeTag = '';
            document.querySelectorAll('.tag-option').forEach(t => t.classList.remove('selected'));
            document.getElementById('treehole-post-modal').classList.add('active');
        }

        function closeTreeholePostModal() {
            document.getElementById('treehole-post-modal').classList.remove('active');
        }

        function selectTreeholeTag(el) {
            document.querySelectorAll('.tag-option').forEach(t => t.classList.remove('selected'));
            el.classList.add('selected');
            currentTreeholeTag = el.dataset.tag;
        }

        function generateAnonymousName() {
            const name = anonymousNames[Math.floor(Math.random() * anonymousNames.length)];
            const num = Math.floor(Math.random() * 9000 + 1000);
            return `${name}#${num}`;
        }

        // 敏感词检测
        function checkSensitiveWords(text) {
            for (let word of sensitiveWords) {
                if (text.toLowerCase().includes(word.toLowerCase())) {
                    return word;
                }
            }
            return null;
        }

        // 提交树洞
        async function submitTreeholePost() {
            const content = document.getElementById('treehole-post-content').value.trim();
            
            if (!content) {
                showToast('写点什么吧');
                return;
            }
            
            // 检测敏感词
            const sensitiveWord = checkSensitiveWords(content);
            if (sensitiveWord) {
                showToast('说点正经的');
                return;
            }
            
            if (!sb) { showToast('网络异常，请稍后重试'); return; }
            try {
                // 写入 Supabase
                const { data, error } = await sb.from('treehole_posts').insert([{
                    content: content
                }]).select().single();

                if (error) {
                    console.error('树洞发帖失败:', error);
                    showToast('发帖失败，请重试');
                    return;
                }

                closeTreeholePostModal();
                
                const newPost = {
                    id: data.id,
                    author: currentAnonymousName,
                    tag: currentTreeholeTag || 'free',
                    content: content,
                    time: '刚刚',
                    warms: 0,
                    hugs: 0,
                    comments: 0
                };
                
                // 检测未证实信息
                if (content.includes('据说') || content.includes('听说') || content.includes('小道消息')) {
                    newPost.unverified = true;
                }
                
                // 检测健康/医疗/投资领域
                if (content.includes('健康') || content.includes('医疗') || content.includes('投资') || content.includes('股票')) {
                    newPost.disclaimer = true;
                }
                
                treeholePosts.unshift(newPost);
                userPostCount++;
                renderTreeholeFull();
                showToast('说出来就好 🌙');
            } catch (e) {
                console.error('树洞发帖异常:', e);
                showToast('发帖失败，请重试');
            }
        }

        function handleFileUpload(input) {
            const preview = document.getElementById('upload-preview');
            preview.innerHTML = '';
            
            if (input.files) {
                Array.from(input.files).slice(0, 9).forEach(file => {
                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            preview.innerHTML += `
                                <div class="preview-item">
                                    <img src="${e.target.result}" alt="预览">
                                    <div class="preview-remove" onclick="removePreview(this)">×</div>
                                </div>
                            `;
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }
        }

        function removePreview(el) {
            el.parentElement.remove();
        }

        async function submitPost() {
            const category = document.getElementById('post-category').value;
            const title = document.getElementById('post-title').value;
            const content = document.getElementById('post-content').value;
            
            if (!category) {
                showToast('选个板块吧');
                return;
            }
            if (!title.trim()) {
                showToast('写个标题');
                return;
            }
            if (!content.trim()) {
                showToast('写点什么');
                return;
            }
            
            // 检测敏感词
            const sensitiveWordTitle = checkSensitiveWords(title);
            const sensitiveWordContent = checkSensitiveWords(content);
            if (sensitiveWordTitle || sensitiveWordContent) {
                showToast('说点正经的');
                return;
            }

            if (!sb) { showToast('网络异常，请稍后重试'); return; }
            try {
                // 写入 Supabase
                const { data, error } = await sb.from('posts').insert([{
                    category: category,
                    title: title.trim(),
                    content: content.trim(),
                    author_nickname: userName,
                    author_avatar: userAvatar,
                    tag: ''
                }]).select().single();

                if (error) {
                    console.error('发帖失败:', error);
                    showToast('发帖失败，请重试');
                    return;
                }
                
                closePostModal();
                showToast('说出来了');
                userPostCount++;

                // 刷新帖子列表
                await loadPostsFromDB();
                renderHotPosts();
            } catch (e) {
                console.error('发帖异常:', e);
                showToast('发帖失败，请重试');
            }
        }

        async function submitTreehole() {
            const content = document.getElementById('treehole-content').value;
            
            if (!content.trim()) {
                showToast('写点什么吧');
                return;
            }
            
            // 检测敏感词
            const sensitiveWord = checkSensitiveWords(content);
            if (sensitiveWord) {
                showToast('说点正经的');
                return;
            }

            // 写入 Supabase 树洞表
            if (!sb) { showToast('网络异常，请稍后重试'); return; }
            const { data, error } = await sb.from('treehole_posts').insert([{
                content: content.trim()
            }]).select().single();

            if (error) {
                console.error('树洞发帖失败:', error);
                showToast('发帖失败，请重试');
                return;
            }
            
            closeTreeholeModal();
            document.getElementById('treehole-content').value = '';
            
            // 刷新树洞列表
            await loadTreeholePostsFromDB();
            showToast('说出来就好');
        }

        async function submitComment(postId) {
            // 检查登录状态
            if (isGuest || !isLoggedIn) {
                showToast('请先登录后再评论');
                document.getElementById('login-page').style.display = 'flex';
                return;
            }
            
            const input = document.getElementById(`comment-input-${postId}`);
            if (input && input.value.trim()) {
                // 检测敏感词
                const sensitiveWord = checkSensitiveWords(input.value);
                if (sensitiveWord) {
                    showToast('说点正经的');
                    return;
                }
                
                if (!sb) { showToast('网络异常，请稍后重试'); return; }
                try {
                    // 写入 Supabase
                    const { error } = await sb.from('comments').insert([{
                        post_id: postId,
                        content: input.value.trim(),
                        author_nickname: userName,
                        author_avatar: userAvatar
                    }]);

                    if (error) {
                        console.error('评论失败:', error);
                        showToast('评论失败，请重试');
                        return;
                    }

                    // 更新帖子评论计数：先查当前值再+1
                    const { data: postData } = await sb.from('posts').select('comments_count').eq('id', postId).single();
                    if (postData) {
                        await sb.from('posts').update({ comments_count: (postData.comments_count || 0) + 1 }).eq('id', postId);
                    }

                    showToast('说出来了');
                    input.value = '';

                    // 刷新帖子详情，显示新评论
                    const catId = getCategoryByPostId(postId);
                    showPostDetail(postId, catId);
                } catch (e) {
                    console.error('评论异常:', e);
                    showToast('评论失败，请重试');
                }
            }
        }

        // 举报功能
        function openReportModal(type, id) {
            currentReportTarget = { type, id };
            selectedReportReason = null;
            document.querySelectorAll('.report-reason').forEach(r => r.classList.remove('selected'));
            document.getElementById('report-modal').classList.add('active');
        }

        function closeReportModal() {
            document.getElementById('report-modal').classList.remove('active');
            currentReportTarget = null;
            selectedReportReason = null;
        }

        function selectReportReason(el) {
            document.querySelectorAll('.report-reason').forEach(r => r.classList.remove('selected'));
            el.classList.add('selected');
            selectedReportReason = el.dataset.reason;
        }

        function submitReport() {
            if (!selectedReportReason) {
                showToast('请选择举报原因');
                return;
            }
            
            closeReportModal();
            showToast('已收到举报，我们将尽快审核处理');
        }

        async function toggleLike(el, postId) {
            if (isGuest || !isLoggedIn) {
                showToast('请先登录后再点赞');
                document.getElementById('login-page').style.display = 'flex';
                return;
            }

            // Supabase 不可用时，用 localStorage 兜底
            if (!sb) {
                const likeKey = 'daoh_likes_' + userName;
                const likes = JSON.parse(localStorage.getItem(likeKey) || '{}');
                const isLiked = el.classList.contains('liked');
                const count = el.querySelector('span:last-child');
                const current = parseInt(count.textContent) || 0;
                if (isLiked) {
                    delete likes[postId];
                    el.classList.remove('liked');
                    count.textContent = Math.max(0, current - 1);
                } else {
                    likes[postId] = true;
                    el.classList.add('liked');
                    count.textContent = current + 1;
                }
                localStorage.setItem(likeKey, JSON.stringify(likes));
                return;
            }

            try {
                const isLiked = el.classList.contains('liked');
                const count = el.querySelector('span:last-child');
                const current = parseInt(count.textContent);

                if (isLiked) {
                    // 取消点赞
                    const { error } = await sb.from('likes').delete()
                        .eq('user_nickname', userName)
                        .eq('post_id', postId);
                    if (error) {
                        console.error('取消点赞失败:', error);
                        return;
                    }
                    el.classList.remove('liked');
                    count.textContent = current - 1;
                    // 更新帖子计数
                    const { data: pd } = await sb.from('posts').select('likes_count').eq('id', postId).single();
                    if (pd) {
                        await sb.from('posts').update({ likes_count: Math.max(0, (pd.likes_count || 0) - 1) }).eq('id', postId);
                    }
                } else {
                    // 点赞
                    const { error } = await sb.from('likes').insert([{
                        user_nickname: userName,
                        post_id: postId
                    }]);
                    if (error) {
                        if (error.code === '23505') {
                            // 已点赞过，忽略
                            return;
                        }
                        console.error('点赞失败:', error);
                        showToast('点赞失败，请重试');
                        return;
                    }
                    el.classList.add('liked');
                    count.textContent = current + 1;
                    // 更新帖子计数
                    const { data: pd } = await sb.from('posts').select('likes_count').eq('id', postId).single();
                    if (pd) {
                        await sb.from('posts').update({ likes_count: (pd.likes_count || 0) + 1 }).eq('id', postId);
                    }
                }
            } catch (e) {
                console.error('点赞异常:', e);
                showToast('操作失败，请重试');
            }
        }

        function showToast(message) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2500);
        }

        function toggleMobileMenu() {
            const menu = document.getElementById('mobile-menu');
            const overlay = document.getElementById('mobile-menu-overlay');
            if (menu && overlay) {
                const isOpen = menu.classList.contains('active');
                if (isOpen) {
                    closeMobileMenu();
                } else {
                    menu.classList.add('active');
                    overlay.classList.add('active');
                    updateMobileMenuUserInfo();
                }
            }
        }
        
        function closeMobileMenu() {
            const menu = document.getElementById('mobile-menu');
            const overlay = document.getElementById('mobile-menu-overlay');
            if (menu && overlay) {
                menu.classList.remove('active');
                overlay.classList.remove('active');
            }
        }
        
        function updateMobileMenuUserInfo() {
            const avatarEl = document.getElementById('mobile-menu-avatar');
            const nameEl = document.getElementById('mobile-menu-name');
            const descEl = document.getElementById('mobile-menu-desc');
            if (isLoggedIn) {
                if (avatarEl) avatarEl.textContent = userAvatar || '👨';
                if (nameEl) nameEl.textContent = userName || '道合用户';
                if (descEl) descEl.textContent = '志同道合，一路同行';
            } else {
                if (avatarEl) avatarEl.textContent = '👤';
                if (nameEl) nameEl.textContent = '游客';
                if (descEl) descEl.textContent = '点击登录/注册';
            }
        }

        // 统一初始化入口
        document.addEventListener('DOMContentLoaded', () => {
            // 每个模块独立 try-catch，一个崩不影响其他的
            try { renderInterestCircles(); } catch(e) { console.error('[renderInterestCircles] error:', e); }
            try { renderCategories(); } catch(e) { console.error('[renderCategories] error:', e); }
            try { renderHotPosts(); } catch(e) { console.error('[renderHotPosts] error:', e); }
            try { renderHotTopics(); } catch(e) { console.error('[renderHotTopics] error:', e); }
            try { renderActiveUsers(); } catch(e) { console.error('[renderActiveUsers] error:', e); }
            try { renderTreeholePreview_placeholder(); } catch(e) { console.error('[renderTreeholePreview] error:', e); }
            try { renderTreeholeFull(); } catch(e) { console.error('[renderTreeholeFull] error:', e); }
            try { renderDailyQuestion(); } catch(e) { console.error('[renderDailyQuestion] error:', e); }
            try { renderVeteranPreview(); } catch(e) { console.error('[renderVeteranPreview] error:', e); }
            try { initDeepNight(); } catch(e) { console.error('[initDeepNight] error:', e); }
            try { checkMoodPrompt(); } catch(e) { console.error('[checkMoodPrompt] error:', e); }
            // 首页模块初始化
            try { initHomeModules(); } catch(e) { console.error('[initHomeModules] error:', e); }
            try { initTopicCharCount(); } catch(e) { console.error('[initTopicCharCount] error:', e); }
            
            // 异步初始化：从 Supabase 恢复登录状态和数据
            initApp().then(() => {
                // 数据加载完成后重新渲染
                try { renderHotPosts(); } catch(e) { console.error('[re-renderHotPosts] error:', e); }
                try { renderTreeholeFull(); } catch(e) { console.error('[re-renderTreeholeFull] error:', e); }
            });
        });

        // ==================== 首页模块化功能函数 ====================

        // 初始化首页模块
        function initHomeModules() {
            try { initGoldenQuote(); } catch(e) { console.error('[initGoldenQuote] error:', e); }
            try { initTodayTopic(); } catch(e) { console.error('[initTodayTopic] error:', e); }
            try { renderInterestCircles(); } catch(e) { console.error('[renderInterestCircles] error:', e); }
            try { updateHomeUserInfo(); } catch(e) { console.error('[updateHomeUserInfo] error:', e); }
        }

        // 金句卡片关闭功能
        function closeGoldenQuote() {
            const quoteCard = document.getElementById('golden-quote-card');
            if (quoteCard) {
                quoteCard.classList.add('hidden');
                // 存储状态，下次刷新不显示
                localStorage.setItem('goldenQuoteClosed', 'true');
            }
        }

        // 初始化励志金句
        function initGoldenQuote() {
            const today = new Date();
            const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
            const quoteIndex = dayOfYear % goldenQuotes.length;
            const quote = goldenQuotes[quoteIndex];
            
            const quoteTextEl = document.getElementById('golden-quote-text');
            const quoteFooterEl = document.getElementById('golden-quote-footer');
            const quoteCard = document.getElementById('golden-quote-card');
            
            if (quoteTextEl) quoteTextEl.textContent = quote.text;
            if (quoteFooterEl) quoteFooterEl.textContent = quote.footer;
            
            // 检查是否之前关闭过
            if (quoteCard && localStorage.getItem('goldenQuoteClosed') === 'true') {
                quoteCard.classList.add('hidden');
            }
        }

        // 初始化今日话题
        function initTodayTopic() {
            const today = new Date();
            const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
            const topicIndex = dayOfYear % todayTopics.length;
            const topic = todayTopics[topicIndex];
            
            const topicEl = document.getElementById('today-topic-question');
            const dateEl = document.getElementById('topic-date');
            
            if (topicEl) {
                topicEl.textContent = topic;
            } else {
                console.error('[initTodayTopic] today-topic-question element not found');
            }
            
            if (dateEl) {
                const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
                dateEl.textContent = months[today.getMonth()] + today.getDate() + '日';
            }
        }

        // 提交话题回答
        // 获取今日话题当天的key
        function getTopicKey() {
            const today = new Date();
            const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
            return `topicAnswers_${today.getFullYear()}_${dayOfYear}`;
        }

        // 渲染今日话题的回答
        function renderTopicAnswers() {
            const container = document.getElementById('today-topic-answers');
            if (!container) return;
            const key = getTopicKey();
            const answers = JSON.parse(localStorage.getItem(key) || '[]');
            if (answers.length === 0) {
                container.innerHTML = '';
                return;
            }
            let html = `<div class="topic-answer-title">💬 ${answers.length}个兄弟的看法</div>`;
            answers.forEach(a => {
                const initial = (a.author || '匿')[0];
                html += `
                    <div class="topic-answer-item">
                        <div class="topic-answer-author">
                            <div class="topic-answer-avatar">${initial}</div>
                            <span class="topic-answer-name">${a.author || '匿名兄弟'}</span>
                            <span class="topic-answer-time">${a.time || ''}</span>
                        </div>
                        <div class="topic-answer-text">${a.text}</div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        function submitTopicAnswer() {
            const answer = document.getElementById('topic-answer').value.trim();
            
            if (!answer) {
                showToast('写点什么吧');
                return;
            }
            
            // 检测敏感词
            const sensitiveWord = checkSensitiveWords(answer);
            if (sensitiveWord) {
                showToast('说点正经的');
                return;
            }
            
            // 保存到localStorage
            const key = getTopicKey();
            const answers = JSON.parse(localStorage.getItem(key) || '[]');
            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
            answers.unshift({
                author: isLoggedIn && !isGuest ? (userName || '匿名兄弟') : '匿名兄弟',
                text: answer,
                time: timeStr
            });
            localStorage.setItem(key, JSON.stringify(answers));
            
            // 清除输入
            document.getElementById('topic-answer').value = '';
            document.getElementById('topic-char-count').textContent = '0';
            
            // 重新渲染回答列表
            renderTopicAnswers();
            
            showToast('说出来了，兄弟们都看到了 👍');
        }

        // 渲染兴趣圈子（2列网格）
        function renderInterestCircles() {
            console.log('renderInterestCircles called, categories count:', categories ? categories.length : 'undefined');
            const grid = document.getElementById('interest-circles-grid');
            if (!grid) {
                console.error('interest-circles-grid not found');
                return;
            }
            console.log('grid found, rendering', categories.length, 'cards');
            
            // 按帖子数量排序，获取TOP排名
            const sortedCategories = [...categories].sort((a, b) => b.posts - a.posts);
            const topRanks = {};
            sortedCategories.forEach((cat, index) => {
                topRanks[cat.id] = index + 1;
            });
            
            grid.innerHTML = categories.map(cat => `
                <div class="interest-circle-card" onclick="showCategory('${cat.id}')">
                    <span class="interest-circle-top">TOP${topRanks[cat.id]}</span>
                    <span class="interest-circle-icon">${cat.icon}</span>
                    <div class="interest-circle-name">${cat.name}</div>
                    <div class="interest-circle-count">${(cat.posts / 10000).toFixed(1)}万人</div>
                </div>
            `).join('');
        }

        // 更新首页用户信息
        function updateHomeUserInfo() {
            const avatarEl = document.getElementById('home-user-avatar');
            const nameEl = document.getElementById('home-user-name');
            
            if (isLoggedIn && userName) {
                if (avatarEl) avatarEl.textContent = userAvatar;
                if (nameEl) nameEl.textContent = userName;
            }
        }

        // 处理认证按钮点击
        function handleVerifyClick() {
            if (isGuest) {
                document.getElementById('login-page').style.display = 'flex';
            } else if (!isLoggedIn) {
                document.getElementById('login-page').style.display = 'flex';
            } else {
                showToast('您已完成认证');
            }
        }

        // ==================== 找兄弟功能函数 ====================

        // 初始化找兄弟页面
        function initFindBroPage() {
            const emptyState = document.getElementById('match-empty-state');
            const resultContainer = document.getElementById('match-result-container');
            
            if (isLoggedIn && userName) {
                // 已完善资料，显示匹配结果
                emptyState.style.display = 'none';
                resultContainer.style.display = 'block';
                renderMatchUsers();
            } else {
                // 未完善资料，显示空状态引导
                emptyState.style.display = 'block';
                resultContainer.style.display = 'none';
            }
        }

        // 渲染匹配用户（模拟数据）
        function renderMatchUsers() {
            const grid = document.getElementById('match-users-grid');
            if (!grid) return;
            
            const mockUsers = [
                { name: '老张', age: '40-45岁', avatar: '🧔', hobbies: ['钓鱼🎣', '喝茶🍵'], bio: '周末总在水库边' },
                { name: '铁柱', age: '35-40岁', avatar: '👨', hobbies: ['健身🏃', '下棋🀄'], bio: '一天不练浑身难受' },
                { name: '大刘', age: '45-50岁', avatar: '🧔', hobbies: ['茶道🍵', '收藏📿'], bio: '老茶客，欢迎交流' },
                { name: '老王', age: '40-45岁', avatar: '👨', hobbies: ['自驾🚗', '摄影📷'], bio: '喜欢记录生活点滴' }
            ];
            
            grid.innerHTML = mockUsers.map(user => `
                <div class="match-user-card">
                    <div class="match-user-avatar">${user.avatar}</div>
                    <div class="match-user-name">${user.name}</div>
                    <div class="match-user-info">${user.age}</div>
                    <div class="match-user-bio">"${user.bio}"</div>
                    <div class="match-user-tags">
                        ${user.hobbies.map(h => `<span class="match-user-tag">${h}</span>`).join('')}
                    </div>
                    <button class="match-user-btn" onclick="showToast('已向${user.name}打招呼')">打招呼</button>
                </div>
            `).join('');
        }

        // 每日一问渲染
        function renderDailyQuestion() {
            currentQuestion = getTodayQuestion();
            document.getElementById('daily-question-text').textContent = currentQuestion;
            const today = new Date();
            const dateStr = `${today.getMonth() + 1}月${today.getDate()}日`;
            document.getElementById('daily-question-date').textContent = dateStr;
        }

        // 过来人说预览渲染
        function renderVeteranPreview() {
            const container = document.getElementById('veteran-preview');
            if (!container) return;
            container.innerHTML = veteranPosts.slice(0, 3).map(post => `
                <div class="veteran-card" onclick="showPage('veteran')">
                    <div class="veteran-card-title">${post.title}</div>
                    <div class="veteran-card-excerpt">${post.excerpt}</div>
                    <div class="veteran-card-meta">
                        <span>👤 ${post.author}</span>
                        <span>⏰ ${post.time}</span>
                        <span>🔥 ${post.warms}</span>
                    </div>
                </div>
            `).join('');

            // 全量页面
            const fullContainer = document.getElementById('veteran-list');
            if (fullContainer) {
                fullContainer.innerHTML = veteranPosts.map(post => `
                    <div class="veteran-card" onclick="showPage('veteran')">
                        <div class="veteran-card-title">${post.title}</div>
                        <div class="veteran-card-excerpt">${post.excerpt}</div>
                        <div class="veteran-card-meta">
                            <span>👤 ${post.author}</span>
                            <span>⏰ ${post.time}</span>
                            <span>🔥 ${post.warms}</span>
                        </div>
                    </div>
                `).join('');
            }
        }

        // 每日一问弹窗
        function openQuestionModal() {
            document.getElementById('question-text').textContent = currentQuestion;
            document.getElementById('question-answer').value = '';
            renderQuestionAnswers();
            document.getElementById('question-modal').classList.add('active');
        }

        function closeQuestionModal() {
            document.getElementById('question-modal').classList.remove('active');
        }

        function renderQuestionAnswers() {
            const container = document.getElementById('answers-preview');
            if (questionAnswers.length === 0) {
                container.innerHTML = '<div class="loading-text">还没有人回答，来做第一个</div>';
            } else {
                container.innerHTML = questionAnswers.slice(0, 5).map((a, i) => `
                    <div class="answer-item">
                        ${a}
                        <div class="answer-meta">${i + 1}楼 · 匿名</div>
                    </div>
                `).join('');
            }
        }

        function submitQuestionAnswer() {
            const answer = document.getElementById('question-answer').value.trim();
            if (!answer) {
                showToast('写点什么吧');
                return;
            }
            const sensitiveWord = checkSensitiveWords(answer);
            if (sensitiveWord) {
                showToast('说点正经的');
                return;
            }
            questionAnswers.push(answer);
            closeQuestionModal();
            showToast('说出来了，舒服点了吗？');
        }

        // 情绪温度计
        function checkMoodPrompt() {
            const lastMood = localStorage.getItem('lastMoodTime');
            const today = new Date().toDateString();
            if (lastMood !== today && !isGuest) {
                setTimeout(() => {
                    document.getElementById('mood-overlay').classList.add('show');
                }, 1000);
            }
        }

        function selectMood(mood) {
            localStorage.setItem('lastMoodTime', new Date().toDateString());
            localStorage.setItem('todayMood', mood);
            document.getElementById('mood-overlay').classList.remove('show');
            const moodText = {
                terrible: '没事，慢慢来',
                low: '低落的时候，说出来会好点',
                okay: '平平淡淡，也是日子',
                good: '不错，保持住',
                great: '真好，替你高兴'
            };
            showToast(moodText[mood] || '收到');
        }

        function skipMood() {
            document.getElementById('mood-overlay').classList.remove('show');
        }

        // 深夜模式
        function initDeepNight() {
            checkDeepNight();
            // 每分钟检查一次
            setInterval(checkDeepNight, 60000);
        }

        function checkDeepNight() {
            const hour = new Date().getHours();
            const isDeepNight = hour >= 22 || hour < 6;
            
            if (isDeepNight) {
                document.body.classList.add('deep-night');
                // 深夜模式：更新树洞入口文案
                updateTreeholeEntrance(true);
                // 深夜模式：更新树洞页面标题
                updateTreeholePageTitle(true);
            } else {
                document.body.classList.remove('deep-night');
                // 白天模式：恢复树洞入口文案
                updateTreeholeEntrance(false);
                // 白天模式：恢复树洞页面标题
                updateTreeholePageTitle(false);
            }
        }

        // 更新树洞入口卡片文案
        function updateTreeholeEntrance(isDeepNight) {
            const title = document.getElementById('treehole-entrance-title');
            const desc = document.getElementById('treehole-entrance-desc');
            const btn = document.getElementById('treehole-entrance-btn-text');
            
            if (isDeepNight) {
                if (title) title.textContent = '深夜树洞';
                if (desc) desc.innerHTML = '卸下盔甲，这里只有自己人。<br>放心，没有人知道你是谁。<br><span style="color: #d4a855;">深夜，终于有人可以说话。</span>';
                if (btn) btn.textContent = '🌙 进入深夜树洞';
            } else {
                if (title) title.textContent = '树洞';
                if (desc) desc.innerHTML = '卸下盔甲，这里只有自己人。<br>放心，没有人知道你是谁。';
                if (btn) btn.textContent = '🌙 进入树洞';
            }
        }

        // 更新树洞页面标题
        function updateTreeholePageTitle(isDeepNight) {
            const pageTitle = document.getElementById('treehole-page-title');
            if (pageTitle) {
                pageTitle.textContent = isDeepNight ? '深夜树洞' : '树洞';
            }
        }

        // [已废弃] submitReport 在后面有最终定义

        // ESC关闭弹窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closePostModal();
                closeTreeholeModal();
                closeTreeholePostModal();
                closeReportModal();
                closeLightbox();
            }
        });

        // ========== 图片视频上传功能 ==========
        let currentPostMedia = [];
        let currentTreeholeMedia = [];
        let currentTreeholePostMedia = [];
        let commentMediaFiles = {};

        function handleFileUpload(input) {
            const preview = document.getElementById('upload-preview');
            currentPostMedia = [];
            
            if (input.files) {
                let imageCount = 0;
                let hasVideo = false;
                
                Array.from(input.files).forEach(file => {
                    if (file.type.startsWith('image/') && imageCount < 9 && !hasVideo) {
                        imageCount++;
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const idx = currentPostMedia.length;
                            currentPostMedia.push({ type: 'image', data: e.target.result });
                            renderPostPreview();
                        };
                        reader.readAsDataURL(file);
                    } else if (file.type.startsWith('video/') && !hasVideo && imageCount === 0) {
                        hasVideo = true;
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            currentPostMedia.push({ type: 'video', data: e.target.result });
                            renderPostPreview();
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }
        }

        function renderPostPreview() {
            const preview = document.getElementById('upload-preview');
            preview.innerHTML = currentPostMedia.map((item, idx) => `
                <div class="preview-item ${item.type === 'video' ? 'is-video' : ''}">
                    ${item.type === 'image' 
                        ? `<img src="${item.data}" alt="预览">` 
                        : `<video src="${item.data}"></video>`}
                    <div class="preview-remove" onclick="removePostMedia(${idx})">×</div>
                </div>
            `).join('');
        }

        function removePostMedia(idx) {
            currentPostMedia.splice(idx, 1);
            renderPostPreview();
        }

        function handleTreeholeFileUpload(input) {
            const preview = document.getElementById('treehole-upload-preview');
            currentTreeholeMedia = [];
            
            if (input.files) {
                Array.from(input.files).slice(0, 9).forEach(file => {
                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            currentTreeholeMedia.push({ type: 'image', data: e.target.result });
                            renderTreeholePreview();
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }
        }

        function renderTreeholePreview() {
            const preview = document.getElementById('treehole-upload-preview');
            preview.innerHTML = currentTreeholeMedia.map((item, idx) => `
                <div class="preview-item">
                    <img src="${item.data}" alt="预览">
                    <div class="preview-remove" onclick="removeTreeholeMedia(${idx})">×</div>
                </div>
            `).join('');
        }

        function removeTreeholeMedia(idx) {
            currentTreeholeMedia.splice(idx, 1);
            renderTreeholePreview();
        }

        function handleTreeholePostFileUpload(input) {
            const preview = document.getElementById('treehole-post-upload-preview');
            currentTreeholePostMedia = [];
            
            if (input.files) {
                Array.from(input.files).slice(0, 9).forEach(file => {
                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            currentTreeholePostMedia.push({ type: 'image', data: e.target.result });
                            renderTreeholePostPreview();
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }
        }

        function renderTreeholePostPreview() {
            const preview = document.getElementById('treehole-post-upload-preview');
            preview.innerHTML = currentTreeholePostMedia.map((item, idx) => `
                <div class="preview-item">
                    <img src="${item.data}" alt="预览">
                    <div class="preview-remove" onclick="removeTreeholePostMedia(${idx})">×</div>
                </div>
            `).join('');
        }

        function removeTreeholePostMedia(idx) {
            currentTreeholePostMedia.splice(idx, 1);
            renderTreeholePostPreview();
        }

        // ========== 评论图片上传 ==========
        function handleCommentImgUpload(postId, input) {
            if (!commentMediaFiles[postId]) {
                commentMediaFiles[postId] = [];
            }
            
            if (input.files) {
                Array.from(input.files).slice(0, 3).forEach(file => {
                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            commentMediaFiles[postId].push({ type: 'image', data: e.target.result });
                            renderCommentPreview(postId);
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }
        }

        function renderCommentPreview(postId) {
            let preview = document.getElementById(`comment-preview-${postId}`);
            if (!preview) {
                const inputWrapper = document.querySelector(`#comment-input-${postId}`).closest('.comment-input-wrapper');
                preview = document.createElement('div');
                preview.className = 'comment-preview-list';
                preview.id = `comment-preview-${postId}`;
                inputWrapper.parentNode.insertBefore(preview, inputWrapper);
            }
            
            preview.innerHTML = commentMediaFiles[postId].map((item, idx) => `
                <div class="comment-preview-item">
                    <img src="${item.data}" alt="预览">
                    <div class="preview-remove" onclick="removeCommentMedia('${postId}', ${idx})">×</div>
                </div>
            `).join('');
        }

        function removeCommentMedia(postId, idx) {
            commentMediaFiles[postId].splice(idx, 1);
            renderCommentPreview(postId);
        }

        // ========== Lightbox 全屏查看 ==========
        let lightboxImages = [];
        let lightboxIndex = 0;

        function openLightbox(images, index = 0) {
            lightboxImages = images;
            lightboxIndex = index;
            document.getElementById('lightbox-image').src = images[index];
            document.getElementById('lightbox-counter').textContent = `${index + 1} / ${images.length}`;
            document.getElementById('lightbox-overlay').classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeLightbox() {
            document.getElementById('lightbox-overlay').classList.remove('active');
            document.body.style.overflow = '';
        }

        function lightboxPrev() {
            lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
            document.getElementById('lightbox-image').src = lightboxImages[lightboxIndex];
            document.getElementById('lightbox-counter').textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
        }

        function lightboxNext() {
            lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
            document.getElementById('lightbox-image').src = lightboxImages[lightboxIndex];
            document.getElementById('lightbox-counter').textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
        }

        // ========== 获取帖子图片网格HTML ==========
        function getPostImagesGrid(images) {
            if (!images || images.length === 0) return '';
            
            const cols = images.length === 1 ? 1 : images.length <= 3 ? 2 : images.length <= 9 ? 3 : 2;
            const isVideo = images.some(img => img.type === 'video');
            
            return `
                <div class="post-images-grid cols-${cols}">
                    ${images.map((img, idx) => {
                        if (img.type === 'video') {
                            return `<div class="post-video-item" onclick="openLightbox(['${img.data}'], ${idx})">
                                <img src="${img.thumb || img.data}" alt="视频">
                            </div>`;
                        }
                        return `<div class="post-image-item" onclick="openLightbox(${JSON.stringify(images.filter(i => i.type !== 'video').map(i => i.data))}, ${idx})">
                            <img src="${img.data}" alt="图片">
                        </div>`;
                    }).join('')}
                </div>
            `;
        }

        // ========== 修改评论提交函数 ==========
        // ========== 清理弹窗函数 ==========
        const originalClosePostModal = closePostModal;
        closePostModal = function() {
            document.getElementById('post-modal').classList.remove('active');
            document.getElementById('post-category').value = '';
            document.getElementById('post-title').value = '';
            document.getElementById('post-content').value = '';
            document.getElementById('upload-preview').innerHTML = '';
            currentPostMedia = [];
        };

        const originalCloseTreeholePostModal = closeTreeholePostModal;
        closeTreeholePostModal = function() {
            document.getElementById('treehole-post-modal').classList.remove('active');
            document.getElementById('treehole-post-content').value = '';
            document.getElementById('treehole-post-upload-preview').innerHTML = '';
            currentTreeholePostMedia = [];
        };

        // 作品展示墙数据
        const worksData = {
            1: { emoji: '🍖', title: '周末做的红烧肉', author: '老陈', likes: 238, desc: '小火慢炖3小时，入口即化。周末给家人做的，大家都说好吃。', time: '2天前' },
            2: { emoji: '🌵', title: '阳台上的多肉', author: '老王', likes: 186, desc: '养了三年的多肉，现在爆盆了。多肉真的很好养，不用怎么管。', time: '1天前' },
            3: { emoji: '🍶', title: '自家酿的米酒', author: '老李', likes: 312, desc: '自己酿的米酒，甜而不腻。冬天喝一杯，浑身暖和。', time: '3天前' },
            4: { emoji: '🌹', title: '院子里的月季', author: '老张', likes: 275, desc: '院子里的月季开了，红的、粉的、黄的，真漂亮。', time: '5小时前' },
            5: { emoji: '🍜', title: '手工拉面的诱惑', author: '老赵', likes: 198, desc: '自己学做手工拉面，虽然卖相一般，但味道不错。', time: '12小时前' },
            6: { emoji: '🪵', title: '盘了三年的核桃', author: '老孙', likes: 420, desc: '从新核桃盘到现在，包浆越来越漂亮了。', time: '1天前' }
        };

        // 作品展示墙点击处理
        showWorkDetail = function(id) {
            const work = worksData[id];
            if (!work) return;
            
            // Get work comments from localStorage
            const getWorkComments = (workId) => {
                const all = JSON.parse(localStorage.getItem('workComments') || '{}');
                return all[workId] || [];
            };
            const saveWorkComments = (workId, comments) => {
                const all = JSON.parse(localStorage.getItem('workComments') || '{}');
                all[workId] = comments;
                localStorage.setItem('workComments', JSON.stringify(all));
            };
            
            // Get like state
            const getWorkLikes = () => JSON.parse(localStorage.getItem('workLikes') || '{}');
            const isWorkLiked = (workId) => {
                const likes = getWorkLikes();
                return likes[workId] === true;
            };
            const getWorkLikeCount = (workId) => {
                const base = work.likes || 0;
                const extra = JSON.parse(localStorage.getItem('workLikeExtras') || '{}');
                return base + (extra[workId] || 0);
            };
            
            const modal = document.createElement('div');
            modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:center;justify-content:center;';
            modal.onclick = function(e) { if(e.target === modal) document.body.removeChild(modal); };
            
            const comments = getWorkComments(id);
            const liked = isWorkLiked(id);
            const likeCount = getWorkLikeCount(id);
            const commentCount = comments.length + Math.floor((work.likes || 0) * 0.3);
            
            modal.innerHTML = `
                <div style="background:#1a1a1f;border-radius:16px;padding:24px;max-width:360px;width:90%;position:relative;max-height:85vh;overflow-y:auto;">
                    <button onclick="document.body.removeChild(this.parentElement.parentElement)" style="position:absolute;top:12px;right:12px;background:none;border:none;color:#999;font-size:24px;cursor:pointer;z-index:1;">×</button>
                    <div style="width:100%;height:200px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:72px;margin-bottom:16px;background:linear-gradient(135deg,#2a2a30,#3a3a40);">${work.emoji}</div>
                    <h3 style="color:#fff;font-size:20px;margin:0 0 8px 0;">${work.title}</h3>
                    <p style="color:#8b7355;font-size:14px;margin:0 0 12px 0;">${work.author} · ${work.time}</p>
                    <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px 0;">${work.desc}</p>
                    
                    <div style="display:flex;gap:12px;margin-bottom:16px;">
                        <button id="work-like-btn-${id}" onclick="toggleWorkLike(${id})" style="flex:1;text-align:center;padding:12px;background:${liked ? '#3a2a20' : '#2a2a30'};border:1px solid ${liked ? '#8b5a30' : '#3a3a40'};border-radius:10px;color:${liked ? '#e8a040' : '#8b7355'};font-size:15px;cursor:pointer;transition:all 0.2s;">
                            👍 <span id="work-like-count-${id}">${likeCount}</span>
                        </button>
                        <div style="flex:1;text-align:center;padding:12px;background:#2a2a30;border-radius:10px;color:#8b7355;font-size:15px;">
                            💬 <span id="work-comment-count-${id}">${commentCount}</span>
                        </div>
                    </div>
                    
                    <div style="border-top:1px solid #2a2a30;padding-top:12px;">
                        <div style="color:#666;font-size:13px;margin-bottom:8px;">评论</div>
                        <div id="work-comment-list-${id}" style="max-height:150px;overflow-y:auto;margin-bottom:10px;">
                            ${comments.length === 0 ? '<div style="text-align:center;color:#555;font-size:12px;padding:8px 0;">暂无评论，来说两句吧</div>' : 
                            comments.map(c => `
                                <div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid #2a2a30;">
                                    <span style="font-size:16px;">${c.avatar || '👨'}</span>
                                    <div style="flex:1;">
                                        <div style="font-size:12px;color:#8b7355;">${c.author}</div>
                                        <div style="font-size:13px;color:#ccc;line-height:1.4;">${c.content}</div>
                                        <div style="font-size:11px;color:#555;margin-top:2px;">${c.time}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div style="display:flex;gap:8px;">
                            <input type="text" id="work-comment-input-${id}" placeholder="说点什么..." maxlength="200" style="flex:1;background:#2a2a30;border:1px solid #3a3a40;border-radius:20px;padding:8px 14px;color:#fff;font-size:13px;outline:none;" onkeydown="if(event.key==='Enter')submitWorkComment(${id})">
                            <button onclick="submitWorkComment(${id})" style="background:linear-gradient(135deg,#5b7fc7,#4a6ba5);color:#fff;border:none;border-radius:20px;padding:8px 16px;font-size:13px;cursor:pointer;white-space:nowrap;">发送</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Store helpers on modal for access by other functions
            modal._workId = id;
            modal._getWorkComments = getWorkComments;
            modal._saveWorkComments = saveWorkComments;
            modal._work = work;
            
            setTimeout(() => {
                const input = document.getElementById('work-comment-input-' + id);
                if (input) input.focus();
            }, 200);
        };
        
        function toggleWorkLike(id) {
            if (!isLoggedIn) { alert('登录后才能点赞'); return; }
            const likes = JSON.parse(localStorage.getItem('workLikes') || '{}');
            const extras = JSON.parse(localStorage.getItem('workLikeExtras') || '{}');
            const btn = document.getElementById('work-like-btn-' + id);
            const countEl = document.getElementById('work-like-count-' + id);
            if (!btn || !countEl) return;
            
            if (likes[id]) {
                delete likes[id];
                extras[id] = (extras[id] || 1) - 1;
                btn.style.background = '#2a2a30';
                btn.style.borderColor = '#3a3a40';
                btn.style.color = '#8b7355';
            } else {
                likes[id] = true;
                extras[id] = (extras[id] || 0) + 1;
                btn.style.background = '#3a2a20';
                btn.style.borderColor = '#8b5a30';
                btn.style.color = '#e8a040';
            }
            localStorage.setItem('workLikes', JSON.stringify(likes));
            localStorage.setItem('workLikeExtras', JSON.stringify(extras));
            
            // Find base likes from worksData
            const work = worksData[id];
            const base = work ? (work.likes || 0) : 0;
            countEl.textContent = base + (extras[id] || 0);
        }
        
        function submitWorkComment(id) {
            if (!isLoggedIn) { alert('登录后才能评论'); return; }
            const input = document.getElementById('work-comment-input-' + id);
            if (!input) return;
            const text = input.value.trim();
            if (!text) return;
            
            const all = JSON.parse(localStorage.getItem('workComments') || '{}');
            if (!all[id]) all[id] = [];
            all[id].push({
                author: userName,
                avatar: userAvatar || '👨',
                content: text,
                time: '刚刚'
            });
            localStorage.setItem('workComments', JSON.stringify(all));
            
            input.value = '';
            
            // Re-render the modal
            document.querySelectorAll('[id^="work-comment-list-"]').forEach(el => {
                const workId = el.id.replace('work-comment-list-', '');
                if (parseInt(workId) === id) {
                    el.innerHTML = all[id].map(c => `
                        <div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid #2a2a30;">
                            <span style="font-size:16px;">${c.avatar || '👨'}</span>
                            <div style="flex:1;">
                                <div style="font-size:12px;color:#8b7355;">${c.author}</div>
                                <div style="font-size:13px;color:#ccc;line-height:1.4;">${c.content}</div>
                                <div style="font-size:11px;color:#555;margin-top:2px;">${c.time}</div>
                            </div>
                        </div>
                    `).join('');
                    el.scrollTop = el.scrollHeight;
                }
            });
            
            // Update comment count
            const work = worksData[id];
            const baseComments = work ? Math.floor((work.likes || 0) * 0.3) : 0;
            const countEl = document.getElementById('work-comment-count-' + id);
            if (countEl) countEl.textContent = baseComments + all[id].length;
        }
    