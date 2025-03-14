import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [tokenData, setTokenData] = useState(null)
  const [error, setError] = useState(null)
  const [recentlyPlayed, setRecentlyPlayed] = useState(null)
  
  // 스포티파이 로그인 함수 (Implicit Grant Flow 사용)
  const handleSpotifyLogin = () => {
    const CLIENT_ID = '#여기';
    const REDIRECT_URI = 'http://localhost:5173/callback';
    const STATE = generateRandomString(16);
    const SCOPE = 'user-read-private user-read-email user-read-recently-played';
    
    // 상태를 로컬 스토리지에 저장
    localStorage.setItem('spotify_auth_state', STATE);
    
    // 스포티파이 인증 URL로 리다이렉트 (response_type을 token으로 변경)
    window.location.href = 'https://accounts.spotify.com/authorize?' + 
      new URLSearchParams({
        response_type: 'token', // code 대신 token 사용
        client_id: CLIENT_ID,
        scope: SCOPE,
        redirect_uri: REDIRECT_URI,
        state: STATE
      }).toString();
  }
  
  // 랜덤 문자열 생성 함수
  const generateRandomString = (length: number) => {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    
    for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  };
  
  // 최근 재생 목록 가져오기
  const fetchRecentlyPlayed = async (accessToken: string) => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/recently-played', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error('최근 재생 목록을 가져오는데 실패했습니다');
      }
      
      const data = await response.json();
      console.log('최근 재생 목록:', data);
      setRecentlyPlayed(data);
    } catch (err) {
      console.error('최근 재생 목록 요청 오류:', err);
      setError(err.message);
    }
  };
  
  // 콜백 처리 (해시 파라미터에서 토큰 추출)
  useEffect(() => {
    // URL 해시에서 토큰 정보 추출
    const getHashParams = () => {
      const hashParams: Record<string, string> = {};
      const hash = window.location.hash.substring(1);
      
      if (!hash) return null;
      
      const params = hash.split('&');
      for (let i = 0; i < params.length; i++) {
        const pair = params[i].split('=');
        hashParams[pair[0]] = decodeURIComponent(pair[1]);
      }
      
      return hashParams;
    };
    
    // URL 파라미터 처리
    const params = getHashParams();
    const storedState = localStorage.getItem('spotify_auth_state');
    
    if (params) {
      if (params.error) {
        setError(`인증 오류: ${params.error}`);
      } else if (params.state !== storedState) {
        setError('상태 불일치 오류가 발생했습니다');
      } else if (params.access_token) {
        // 토큰 정보 저장
        setTokenData({
          access_token: params.access_token,
          token_type: params.token_type,
          expires_in: params.expires_in,
          state: params.state
        });
        setIsLoggedIn(true);
        
        // 사용자 정보 가져오기
        fetchUserProfile(params.access_token);
        
        // 최근 재생 목록 가져오기
        fetchRecentlyPlayed(params.access_token);
        
        // 상태 정보 삭제
        localStorage.removeItem('spotify_auth_state');
        
        // URL에서 해시 제거 (선택 사항)
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);
  
  // 사용자 프로필 정보 가져오기
  const fetchUserProfile = async (accessToken: string) => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error('프로필 정보를 가져오는데 실패했습니다');
      }
      
      const profileData = await response.json();
      console.log('사용자 프로필:', profileData);
      
      // 프로필 정보를 토큰 데이터에 추가
      setTokenData(prevData => ({
        ...prevData,
        profile: profileData
      }));
    } catch (err) {
      console.error('프로필 요청 오류:', err);
    }
  };

  // 트랙 정보 표시 컴포넌트
  const TrackItem = ({ track }) => (
    <div className="track-item">
      <img 
        src={track.album.images[0]?.url} 
        alt={track.album.name} 
        width="60" 
        height="60" 
      />
      <div className="track-info">
        <div className="track-name">{track.name}</div>
        <div className="artist-name">{track.artists.map(artist => artist.name).join(', ')}</div>
        <div className="album-name">{track.album.name}</div>
      </div>
    </div>
  );

  // 멀티라인 그래프 컴포넌트
  const MultiLineGraph = () => {
    const [hoveredLine, setHoveredLine] = useState(null);
    const [selectedLine, setSelectedLine] = useState(null);
    const [graphWidth, setGraphWidth] = useState(0);
    
    // 그래프 컨테이너 ref
    const graphContainerRef = useRef(null);
    
    // 화면 크기에 따라 그래프 너비 조정
    useEffect(() => {
      const updateGraphWidth = () => {
        if (graphContainerRef.current) {
          const containerWidth = graphContainerRef.current.clientWidth;
          // 패딩을 고려한 실제 사용 가능한 너비 계산
          const availableWidth = containerWidth - 40; // 좌우 패딩 20px씩
          
          // 최소 320px, 최대 600px로 제한
          const newWidth = Math.max(320, Math.min(600, availableWidth));
          setGraphWidth(newWidth);
        }
      };
      
      // 초기 너비 설정
      updateGraphWidth();
      
      // 창 크기 변경 시 너비 업데이트
      window.addEventListener('resize', updateGraphWidth);
      
      return () => {
        window.removeEventListener('resize', updateGraphWidth);
      };
    }, []);
    
    // 샘플 데이터 (0-100 사이의 값)
    const graphData = [
      { id: 1, name: "개방성", values: [65, 59, 80, 81, 56, 55, 40], color: "#FFE469"},
      { id: 2, name: "성실성", values: [28, 48, 40, 19, 86, 27, 90], color: "#FFCC90"},
      { id: 3, name: "외향성", values: [80, 40, 32, 45, 78, 52, 63], color: "#BAE28C"},
      { id: 4, name: "우호성", values: [45, 70, 75, 38, 25, 60, 85], color: "#F4BDFF"},
      { id: 5, name: "신경성", values: [20, 35, 60, 90, 50, 75, 30], color: "#9ED9FF"}
    ];
    
    // 그래프 설정
    const height = 400;
    const padding = 40;
    const graphContentWidth = graphWidth - (padding * 2);
    const graphHeight = height - (padding * 2);
    
    // 각 데이터 포인트의 x 좌표 계산
    const xPoints = graphData[0].values.map((_, i) => 
      padding + (i * (graphContentWidth / (graphData[0].values.length - 1)))
    );
    
    // 범례 클릭 핸들러
    const handleLegendClick = (lineId) => {
      if (selectedLine === lineId) {
        setSelectedLine(null); // 같은 항목 다시 클릭하면 선택 해제
      } else {
        setSelectedLine(lineId); // 다른 항목 클릭하면 선택
      }
    };
    
    return (
      <div className="graph-container" ref={graphContainerRef}>
        <h2>음악 특성 분석</h2>
        <p className="graph-instruction">범례를 클릭하거나 마우스를 올려 해당 특성을 확인하세요</p>
        <div className="graph-legend">
          {graphData.map((line) => {
            const isSelected = selectedLine === line.id;
            const isHovered = hoveredLine === line.id;
            const isActive = isSelected || isHovered || (selectedLine === null && hoveredLine === null);
            
            return (
              <div 
                key={line.id} 
                className={`legend-item ${isSelected ? 'selected' : ''}`}
                onMouseEnter={() => setHoveredLine(line.id)}
                onMouseLeave={() => setHoveredLine(null)}
                onClick={() => handleLegendClick(line.id)}
              >
                <div 
                  className="legend-color" 
                  style={{ 
                    backgroundColor: line.color,
                    opacity: isActive ? 1 : 0.3
                  }}
                ></div>
                <span>{line.name}</span>
              </div>
            );
          })}
        </div>
        <div className="svg-container">
          <svg width={graphWidth} height={height}>
            {/* 배경 그리드 라인 (Y축 눈금 대신) */}
            {[0, 25, 50, 75, 100].map(tick => (
              <g key={tick}>
                <line 
                  x1={padding} 
                  y1={padding + graphHeight - (tick / 100 * graphHeight)} 
                  x2={graphWidth - padding} 
                  y2={padding + graphHeight - (tick / 100 * graphHeight)}
                  stroke="#eee"
                  strokeDasharray="5,5"
                  opacity={0.3}
                />
              </g>
            ))}
            
            {/* 각 라인 그리기 */}
            {graphData.map((line) => {
              // 각 데이터 포인트의 y 좌표 계산
              const yPoints = line.values.map(val => 
                padding + graphHeight - (val / 100 * graphHeight)
              );
              
              // SVG 경로 생성 - 직선으로 변경
              let pathData = "";
              xPoints.forEach((x, i) => {
                if (i === 0) {
                  pathData += `M ${x} ${yPoints[i]} `;
                } else {
                  // 직선으로 연결
                  pathData += `L ${x} ${yPoints[i]} `;
                }
              });
              
              // 라인 표시 여부 결정
              const isSelected = selectedLine === line.id;
              const isHovered = hoveredLine === line.id;
              // 선택된 라인이 없거나, 현재 라인이 선택/호버된 경우에만 표시
              const shouldDisplay = selectedLine === null || isSelected;
              
              if (!shouldDisplay) return null; // 표시하지 않을 라인은 렌더링하지 않음
              
              const lineWidth = (isSelected || isHovered) ? 5 : 3.5;
              
              return (
                <g key={line.id}>
                  <path 
                    d={pathData} 
                    fill="none" 
                    stroke={line.color}
                    strokeWidth={lineWidth}
                    opacity={0.3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    onMouseEnter={() => setHoveredLine(line.id)}
                    onMouseLeave={() => setHoveredLine(null)}
                  />
                  
                  {/* 데이터 포인트와 점수 표시 */}
                  {xPoints.map((x, i) => (
                    <g key={i}>
                      {/* 모든 데이터 포인트는 동일한 크기로 표시하되 투명하게 */}
                      <circle 
                        cx={x} 
                        cy={yPoints[i]} 
                        r={5}
                        fill={line.color}
                        opacity={0}
                        onMouseEnter={() => setHoveredLine(line.id)}
                        onMouseLeave={() => setHoveredLine(null)}
                      />
                      
                      {/* 점수 표시 - 선택된 라인만 표시 (호버 제외) */}
                      {isSelected && (
                        <text
                          x={x}
                          y={yPoints[i] - 20} // 점 위에 표시
                          textAnchor="middle"
                          fill={line.color}
                          fontWeight="bold"
                          fontSize="20"
                        >
                          {line.values[i]}
                        </text>
                      )}
                    </g>
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      <h1>스포티파이 로그인</h1>
      
      {/* 멀티라인 그래프 추가 */}
      {isLoggedIn && <MultiLineGraph />}
      
      {/* 최근 재생 목록 표시 */}
      {recentlyPlayed && (
        <div className="recently-played">
          <h2>최근 재생한 곡</h2>
          <div className="tracks-container">
            {recentlyPlayed.items.map((item, index) => (
              <TrackItem key={index} track={item.track} />
            ))}
          </div>
          
          <h3>API 응답 데이터</h3>
          <pre className="api-response">{JSON.stringify(recentlyPlayed, null, 2)}</pre>
        </div>
      )}
      
      {/* 토큰 데이터 또는 오류 표시 */}
      {tokenData && (
        <div className="token-response">
          <h2>인증 성공!</h2>
          <pre>{JSON.stringify(tokenData, null, 2)}</pre>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          <h2>오류 발생</h2>
          <p>{error}</p>
        </div>
      )}
      
      <div className="login-card">
        {isLoggedIn ? (
          <p>스포티파이에 로그인되었습니다!</p>
        ) : (
          <button onClick={handleSpotifyLogin}>
            스포티파이로 로그인
          </button>
        )}
      </div>
    </div>
  )
}

export default App
