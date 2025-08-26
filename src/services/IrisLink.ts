/**
 * TypeScript port of iris.kakaolink.KakaoLinkModule
 * https://github.com/ye-seola/kakaolink-py
 */

import axios, { AxiosInstance } from 'axios';
import { v4 as uuid4 } from 'uuid';

const KAKAOTALK_VERSION = '25.2.1';
const ANDROID_SDK_VER = 33;
const ANDROID_WEBVIEW_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-G998B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/114.0.5735.60 Mobile Safari/537.36';

// Exception classes
export class KakaoLinkException extends Error {}
export class KakaoLinkReceiverNotFoundException extends KakaoLinkException {}
export class KakaoLinkLoginException extends KakaoLinkException {}
export class KakaoLink2FAException extends KakaoLinkException {}
export class KakaoLinkSendException extends KakaoLinkException {}

export interface KakaoLinkTemplate {
  [key: string]: any;
}

export type SearchFrom = 'ALL' | 'FRIENDS' | 'CHATROOMS';
export type SearchRoomType =
  | 'ALL'
  | 'OpenMultiChat'
  | 'MultiChat'
  | 'DirectChat';

class KakaoLinkCookieStorage {
  private localStorage: Record<string, any> = {};

  async save(cookies: Record<string, any>): Promise<void> {
    this.localStorage = cookies;
  }

  async load(): Promise<Record<string, any>> {
    return this.localStorage;
  }

  clear(): void {
    this.localStorage = {};
  }
}

class KakaoLinkAuthorizationProvider {
  private irisUrl: string;

  constructor(irisUrl: string) {
    this.irisUrl = `http://${irisUrl}`;
  }

  async getAuthorization(): Promise<string> {
    const response = await axios.get(`${this.irisUrl}/aot`);
    const aot = response.data.aot;
    return `${aot.access_token}-${aot.d_id}`;
  }
}

export class KakaoLink {
  private defaultAppKey?: string;
  private defaultOrigin?: string;
  private cookies: Record<string, any> = {};
  private sendLock = false;
  private authorizationProvider: KakaoLinkAuthorizationProvider;
  private cookieStorage: KakaoLinkCookieStorage;
  private httpClient: AxiosInstance;

  constructor(irisUrl: string, defaultAppKey?: string, defaultOrigin?: string) {
    this.defaultAppKey = defaultAppKey;
    this.defaultOrigin = defaultOrigin;
    this.authorizationProvider = new KakaoLinkAuthorizationProvider(irisUrl);
    this.cookieStorage = new KakaoLinkCookieStorage();

    this.httpClient = axios.create({
      timeout: 30000,
      validateStatus: () => true, // Don't throw on HTTP errors
    });
  }

  async send(
    receiverName: string,
    templateId: number,
    templateArgs: KakaoLinkTemplate,
    appKey?: string,
    origin?: string,
    searchExact: boolean = true,
    searchFrom: SearchFrom = 'ALL',
    searchRoomType: SearchRoomType = 'ALL'
  ): Promise<void> {
    const finalAppKey = appKey || this.defaultAppKey;
    const finalOrigin = origin || this.defaultOrigin;

    if (!finalAppKey || !finalOrigin) {
      throw new KakaoLinkException(
        'app_key 또는 origin은 비어있을 수 없습니다'
      );
    }

    const ka = this.getKa(finalOrigin);

    // Simple lock mechanism
    while (this.sendLock) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    this.sendLock = true;

    try {
      const pickerData = await this.getPickerData(
        finalAppKey,
        ka,
        templateId,
        templateArgs
      );

      const checksum = pickerData.checksum;
      const csrf = pickerData.csrfToken;
      const shortKey = pickerData.shortKey;

      if (!checksum || !csrf || !shortKey) {
        console.error('카카오링크 전송: 전송 실패', pickerData);
        throw new KakaoLinkSendException();
      }

      const receiver = this.pickerDataSearch(
        receiverName,
        pickerData,
        searchExact,
        searchFrom,
        searchRoomType
      );

      await this.pickerSend(finalAppKey, shortKey, checksum, csrf, receiver);
    } finally {
      this.sendLock = false;
    }
  }

  private async pickerSend(
    appKey: string,
    shortKey: string,
    checksum: string,
    csrf: string,
    receiver: any
  ): Promise<void> {
    const receiverData = Buffer.from(JSON.stringify(receiver), 'utf8').toString(
      'base64url'
    );

    const response = await this.httpClient.post(
      'https://sharer.kakao.com/picker/send',
      new URLSearchParams({
        app_key: appKey,
        short_key: shortKey,
        checksum: checksum,
        _csrf: csrf,
        receiver: receiverData,
      }),
      {
        headers: {
          ...this.getWebHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (response.status === 400) {
      console.error('카카오링크 전송: 전송 실패', response.status);
      throw new KakaoLinkSendException();
    }
  }

  private pickerDataSearch(
    receiverName: string,
    pickerData: any,
    searchExact: boolean,
    searchFrom: SearchFrom,
    searchRoomType: SearchRoomType
  ): any {
    const receivers = [
      ...(searchFrom === 'ALL' || searchFrom === 'CHATROOMS'
        ? pickerData.chats || []
        : []),
      ...(searchFrom === 'ALL' || searchFrom === 'FRIENDS'
        ? pickerData.friends || []
        : []),
    ];

    for (const receiver of receivers) {
      const currentChatType = receiver.chat_room_type;
      const currentTitle = receiver.title || receiver.profile_nickname || '';

      // 챗방일 때 타입 체크
      if (currentChatType) {
        if (searchRoomType !== 'ALL' && searchRoomType !== currentChatType) {
          continue;
        }
      }

      if (searchExact) {
        if (currentTitle === receiverName) {
          return receiver;
        }
      } else {
        if (currentTitle.includes(receiverName)) {
          return receiver;
        }
      }
    }

    throw new KakaoLinkReceiverNotFoundException();
  }

  private async getPickerData(
    appKey: string,
    ka: string,
    templateId: number,
    templateArgs: KakaoLinkTemplate
  ): Promise<any> {
    let response = await this.httpClient.post(
      'https://sharer.kakao.com/picker/link',
      new URLSearchParams({
        app_key: appKey,
        ka: ka,
        validation_action: 'custom',
        validation_params: JSON.stringify({
          link_ver: '4.0',
          template_id: templateId,
          template_args: templateArgs,
        }),
      }),
      {
        headers: {
          ...this.getWebHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        maxRedirects: 5,
      }
    );

    // Handle login redirect
    if (response.request.res.responseUrl?.includes('/login')) {
      const continueUrl = new URL(
        response.request.res.responseUrl
      ).searchParams.get('continue');
      await this.login();

      if (continueUrl) {
        response = await this.httpClient.get(continueUrl, {
          headers: this.getWebHeaders(),
          maxRedirects: 5,
        });
      }
    }

    // Handle 2FA
    if (response.request.res.responseUrl?.includes('/talk_tms_auth/service')) {
      console.log('카카오링크 전송: 추가인증 해결 중');
      const continueUrl = await this.solveTwoFactorAuth(response.data);

      response = await this.httpClient.get(continueUrl, {
        headers: this.getWebHeaders(),
        maxRedirects: 5,
      });
    }

    // Parse server data
    const serverDataMatch = response.data.match(
      /window\.serverData = "([^"]+)"/
    );
    if (!serverDataMatch) {
      throw new KakaoLinkException('서버 데이터를 찾을 수 없습니다');
    }

    const serverData = Buffer.from(
      serverDataMatch[1] + '====',
      'base64url'
    ).toString('utf8');
    return JSON.parse(serverData).data;
  }

  async init(): Promise<void> {
    this.cookies = await this.cookieStorage.load();
    await this.login();
  }

  private async login(): Promise<void> {
    const authorization = await this.authorizationProvider.getAuthorization();
    this.cookies = {};
    this.cookieStorage.clear();

    let authorized = await this.checkAuthorized();
    if (authorized) return;

    const tgtToken = await this.getTgtToken(authorization);
    await this.submitTgtToken(tgtToken);

    authorized = await this.checkAuthorized();
    if (!authorized) {
      console.error(
        '카카오링크 로그인: 알 수 없는 이유로 로그인이 되지 않았습니다'
      );
    }

    await this.cookieStorage.save(this.cookies);
  }

  private async solveTwoFactorAuth(tfaHtml: string): Promise<string> {
    try {
      const propsMatch = tfaHtml.match(
        /<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/
      );
      if (!propsMatch) throw new Error('Props not found');

      const props = JSON.parse(propsMatch[1]);
      const context = props.props.pageProps.pageContext.context;
      const commonContext = props.props.pageProps.pageContext.commonContext;

      const token = context.token;
      const continueUrl = context.continueUrl;
      const csrf = commonContext._csrf;

      await this.confirmToken(token);

      const response = await this.httpClient.post(
        'https://accounts.kakao.com/api/v2/talk_tms_auth/poll_from_service.json',
        { _csrf: csrf, token: token },
        { headers: this.getWebHeaders() }
      );

      const resJson = response.data;
      if (resJson.status !== 0) {
        console.error('카카오링크 추가인증: 알 수 없는 오류', resJson.status);
        throw new KakaoLink2FAException();
      }

      return continueUrl;
    } catch (error) {
      console.error('카카오링크 추가인증: 추가인증 토큰 파싱 실패', error);
      throw new KakaoLink2FAException();
    }
  }

  private async confirmToken(twoFactorToken: string): Promise<void> {
    const response = await this.httpClient.get(
      'https://auth.kakao.com/fa/main.html',
      {
        params: {
          os: 'android',
          country_iso: 'KR',
          lang: 'ko',
          v: KAKAOTALK_VERSION,
          os_version: ANDROID_SDK_VER,
          page: 'additional_auth_with_token',
          additional_auth_token: twoFactorToken,
          close_on_completion: 'true',
          talk_tms_auth_type: 'from_service',
        },
      }
    );

    try {
      const csrfMatch = response.data.match(
        /<meta name="csrf-token" content="([^"]+)"/
      );
      const csrf = csrfMatch[1];

      const optionsMatch = response.data.match(/var options =([^;]+)/);
      const data = JSON.parse(
        optionsMatch[1].replace(/new PageBuilder\(\)/, '').trim()
      );

      const confirmResponse = await this.httpClient.post(
        'https://auth.kakao.com/talk_tms_auth/confirm_token.json',
        new URLSearchParams({
          client_id: data.client_id,
          lang: 'ko',
          os: 'android',
          v: KAKAOTALK_VERSION,
          webview_v: '2',
          token: data.additionalAuthToken,
          talk_tms_auth_type: 'from_service',
          authenticity_token: csrf,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const resJson = confirmResponse.data;
      if (resJson.status !== 0) {
        console.error('카카오링크 추가인증: 알 수 없는 오류', resJson.status);
        throw new KakaoLink2FAException();
      }
    } catch (error) {
      console.error(
        '카카오 링크 추가인증: csrf, client_id 데이터 파싱 실패',
        error
      );
      throw new KakaoLink2FAException();
    }
  }

  private async checkAuthorized(): Promise<boolean> {
    const response = await this.httpClient.get(
      'https://e.kakao.com/api/v1/users/me',
      {
        headers: {
          ...this.getWebHeaders(),
          referer: 'https://e.kakao.com/',
        },
      }
    );

    const resJson = response.data;
    const result = resJson.result || {};
    return result.status === 'VALID';
  }

  private async submitTgtToken(tgtToken: string): Promise<void> {
    const response = await this.httpClient.get('https://e.kakao.com', {
      headers: {
        ...this.getWebHeaders(),
        'ka-tgt': tgtToken,
      },
    });

    if (response.status < 200 || response.status >= 300) {
      throw new KakaoLinkLoginException();
    }
  }

  private async getTgtToken(token: string): Promise<string> {
    const response = await this.httpClient.post(
      'https://api-account.kakao.com/v1/auth/tgt',
      new URLSearchParams({
        key_type: 'talk_session_info',
        key: token,
        referer: 'talk',
      }),
      {
        headers: {
          ...this.getAppHeaders(token),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const resJson = response.data;
    if (resJson.code !== 0) {
      console.error(
        '카카오링크 로그인: tgt 토큰 발급 중 오류가 발생했습니다',
        resJson
      );
      throw new KakaoLinkLoginException();
    }

    return resJson.token;
  }

  private getKa(origin: string): string {
    return `sdk/1.43.5 os/javascript sdk_type/javascript lang/ko-KR device/Linux armv7l origin/${encodeURIComponent(origin)}`;
  }

  private getAppHeaders(token: string): Record<string, string> {
    return {
      A: `android/${KAKAOTALK_VERSION}/ko`,
      C: uuid4(),
      'User-Agent': `KT/${KAKAOTALK_VERSION} An/13 ko`,
      Authorization: token,
    };
  }

  private getWebHeaders(): Record<string, string> {
    return {
      'User-Agent': `${ANDROID_WEBVIEW_UA} KAKAOTALK/${KAKAOTALK_VERSION} (INAPP)`,
      'X-Requested-With': 'com.kakao.talk',
    };
  }
}
