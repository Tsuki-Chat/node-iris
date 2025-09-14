/**
 * TypeScript port of iris.kakaolink.KakaoLinkModule
 * https://github.com/ye-seola/kakaolink-py
 */

import { Logger } from '@/utils/logger';
import got, { Got } from 'got';
import { CookieJar } from 'tough-cookie';
import { v4 as uuid4 } from 'uuid';

const KAKAOTALK_VERSION = '25.2.1';
const ANDROID_SDK_VER = 33;
const ANDROID_WEBVIEW_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-G998B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/114.0.5735.60 Mobile Safari/537.36';

// Exception classes
export class KakaoLinkException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KakaoLinkException';
  }
}

export class KakaoLinkReceiverNotFoundException extends KakaoLinkException {
  constructor() {
    super('Receiver not found');
    this.name = 'KakaoLinkReceiverNotFoundException';
  }
}

export class KakaoLinkLoginException extends KakaoLinkException {
  constructor() {
    super('Login failed');
    this.name = 'KakaoLinkLoginException';
  }
}

export class KakaoLink2FAException extends KakaoLinkException {
  constructor() {
    super('2FA failed');
    this.name = 'KakaoLink2FAException';
  }
}

export class KakaoLinkSendException extends KakaoLinkException {
  constructor() {
    super('Send failed');
    this.name = 'KakaoLinkSendException';
  }
}

// Python's KakaoLinkCookieStorage equivalent
class KakaoLinkCookieStorage {
  private localStorage: Record<string, string> = {};

  async save(cookies: Record<string, string>): Promise<void> {
    this.localStorage = cookies;
  }

  async load(): Promise<Record<string, string>> {
    return this.localStorage;
  }

  clear(): void {
    this.localStorage = {};
  }
}

// Python's KakaoLinkAuthorizationProvider equivalent
class KakaoLinkAuthorizationProvider {
  private irisUrl: string;

  constructor(irisUrl: string) {
    this.irisUrl = `http://${irisUrl}`;
  }

  async getAuthorization(): Promise<string> {
    const response = await got.get(`${this.irisUrl}/aot`).json<any>();
    const aot = response.aot;
    const accessToken = `${aot.access_token}-${aot.d_id}`;
    return accessToken;
  }
}

// Main KakaoLink class - equivalent to Python's KakaoLink
export class KakaoLink {
  private logger: Logger = new Logger('KakaoLink');
  private defaultAppKey?: string;
  private defaultOrigin?: string;
  private _cookies: Record<string, string> = {};
  private _sendLock = false; // Simple boolean lock instead of Python's asyncio.Lock()
  private _authorizationProvider: KakaoLinkAuthorizationProvider;
  private _cookieStorage: KakaoLinkCookieStorage;

  constructor(irisUrl: string, defaultAppKey?: string, defaultOrigin?: string) {
    this.defaultAppKey = defaultAppKey;
    this.defaultOrigin = defaultOrigin;
    this._authorizationProvider = new KakaoLinkAuthorizationProvider(irisUrl);
    this._cookieStorage = new KakaoLinkCookieStorage();
  }

  // Identical to Python's send method
  async send(
    receiverName: string,
    templateId: number,
    templateArgs: Record<string, any>,
    appKey?: string,
    origin?: string,
    searchExact: boolean = true,
    searchFrom: 'ALL' | 'FRIENDS' | 'CHATROOMS' = 'ALL',
    searchRoomType: 'ALL' | 'OpenMultiChat' | 'MultiChat' | 'DirectChat' = 'ALL'
  ): Promise<void> {
    appKey = appKey || this.defaultAppKey;
    origin = origin || this.defaultOrigin;

    if (!appKey || !origin) {
      throw new KakaoLinkException('app_key or origin cannot be empty');
    }

    const ka = this._getKa(origin);

    // Python's async with self._send_lock:
    if (this._sendLock) {
      while (this._sendLock) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    this._sendLock = true;

    try {
      // Python's async with httpx.AsyncClient(cookies=self._cookies) as client:
      const client = this._createHttpClient();

      const pickerData = await this._getPickerData(
        client,
        appKey,
        ka,
        templateId,
        templateArgs
      );

      let checksum: string;
      let csrf: string;
      let shortKey: string;

      try {
        checksum = pickerData['checksum'];
        csrf = pickerData['csrfToken'];
        shortKey = pickerData['shortKey'];
      } catch (error) {
        this.logger.error('KakaoLink send: Send failed', pickerData);
        throw new KakaoLinkSendException();
      }

      const receiver = this._pickerDataSearch(
        receiverName,
        pickerData,
        searchExact,
        searchFrom,
        searchRoomType
      );

      await this._pickerSend(
        client,
        appKey,
        shortKey,
        checksum,
        csrf,
        receiver
      );
    } finally {
      this._sendLock = false;
    }
  }

  // Identical to Python's _picker_send
  private async _pickerSend(
    client: Got,
    appKey: string,
    shortKey: string,
    checksum: string,
    csrf: string,
    receiver: any
  ): Promise<void> {
    const response = await client.post('https://sharer.kakao.com/picker/send', {
      form: {
        app_key: appKey,
        short_key: shortKey,
        checksum: checksum,
        _csrf: csrf,
        receiver: Buffer.from(JSON.stringify(receiver)).toString('base64url'),
      },
    });

    if (response.statusCode === 400) {
      this.logger.error('KakaoLink send: Send failed', response.statusCode);
      throw new KakaoLinkSendException();
    }
  }

  // Identical to Python's _picker_data_search
  private _pickerDataSearch(
    receiverName: string,
    pickerData: any,
    searchExact: boolean,
    searchFrom: 'ALL' | 'FRIENDS' | 'CHATROOMS',
    searchRoomType: 'ALL' | 'OpenMultiChat' | 'MultiChat' | 'DirectChat'
  ): any {
    const receivers = [
      ...(searchFrom === 'ALL' || searchFrom === 'CHATROOMS'
        ? pickerData['chats'] || []
        : []),
      ...(searchFrom === 'ALL' || searchFrom === 'FRIENDS'
        ? pickerData['friends'] || []
        : []),
    ];

    for (const receiver of receivers) {
      const currentChatType = receiver['chat_room_type'];
      const currentTitle =
        receiver['title'] || receiver['profile_nickname'] || '';

      // When it's a chat room
      if (currentChatType) {
        // When search room type is specified and different from current type
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

  // Identical to Python's _get_picker_data
  private async _getPickerData(
    client: Got,
    appKey: string,
    ka: string,
    templateId: number,
    templateArgs: Record<string, any>
  ): Promise<any> {
    let res = await client.post('https://sharer.kakao.com/picker/link', {
      headers: { ...this._getWebHeaders() },
      form: {
        app_key: appKey,
        ka: ka,
        validation_action: 'custom',
        validation_params: JSON.stringify({
          link_ver: '4.0',
          template_id: templateId,
          template_args: templateArgs,
        }),
      },
      followRedirect: false, // Manually handle redirects
      maxRedirects: 0,
    });

    // Manual redirect handling
    let redirectCount = 0;
    while (
      res.statusCode >= 300 &&
      res.statusCode < 400 &&
      redirectCount < 10
    ) {
      const location = res.headers.location;
      if (!location) break;

      redirectCount++;

      // Convert relative URL to absolute URL
      let redirectUrl = location;
      if (location.startsWith('/')) {
        redirectUrl = `https://sharer.kakao.com${location}`;
      } else if (!location.startsWith('http')) {
        redirectUrl = `https://sharer.kakao.com/${location}`;
      }

      res = await client.get(redirectUrl, {
        headers: { ...this._getWebHeaders() },
        followRedirect: false,
        maxRedirects: 0,
      });
    }

    // Python's if res.url.path.startswith("/login"):
    const finalUrl = res.url || res.headers.location || '';
    const urlPath = finalUrl ? new URL(finalUrl).pathname : '';

    if (urlPath.startsWith('/login')) {
      const continueUrl = finalUrl
        ? new URL(finalUrl).searchParams.get('continue')
        : null;

      await this._login(client);

      if (continueUrl) {
        res = await client.get(continueUrl, {
          headers: { ...this._getWebHeaders() },
          followRedirect: false,
          maxRedirects: 0,
        });

        // Continue URL redirect handling as well
        redirectCount = 0;
        while (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          redirectCount < 10
        ) {
          const location = res.headers.location;
          if (!location) break;

          redirectCount++;

          // Convert relative URL to absolute URL
          let redirectUrl = location;
          if (location.startsWith('/')) {
            redirectUrl = `https://sharer.kakao.com${location}`;
          } else if (!location.startsWith('http')) {
            redirectUrl = `https://sharer.kakao.com/${location}`;
          }

          res = await client.get(redirectUrl, {
            headers: { ...this._getWebHeaders() },
            followRedirect: false,
            maxRedirects: 0,
          });
        }
      }
    }

    // Python's if res.url.path.startswith("/talk_tms_auth/service"):
    const finalUrl2 = res.url || res.headers.location || '';
    const urlPath2 = finalUrl2 ? new URL(finalUrl2).pathname : '';

    if (urlPath2.startsWith('/talk_tms_auth/service')) {
      const continueUrl = await this._solveTwoFactorAuth(client, res.body);

      res = await client.get(continueUrl, {
        headers: { ...this._getWebHeaders() },
        followRedirect: false,
        maxRedirects: 0,
      });

      // 2FA continue URL redirect handling as well
      redirectCount = 0;
      while (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        redirectCount < 10
      ) {
        const location = res.headers.location;
        if (!location) break;

        redirectCount++;

        // Convert relative URL to absolute URL
        let redirectUrl = location;
        if (location.startsWith('/')) {
          redirectUrl = `https://sharer.kakao.com${location}`;
        } else if (!location.startsWith('http')) {
          redirectUrl = `https://sharer.kakao.com/${location}`;
        }

        res = await client.get(redirectUrl, {
          headers: { ...this._getWebHeaders() },
          followRedirect: false,
          maxRedirects: 0,
        });
      }
    }

    // Python's return json.loads(base64.urlsafe_b64decode(...))["data"]
    const serverDataMatch = res.body.match(/window\.serverData = "([^"]+)"/);
    if (!serverDataMatch) {
      throw new KakaoLinkException('Server data not found');
    }

    const base64Data = serverDataMatch[1].trim() + '====';
    const decodedData = Buffer.from(base64Data, 'base64url').toString('utf-8');
    const parsedData = JSON.parse(decodedData);
    return parsedData['data'];
  }

  // Identical to Python's init
  async init(): Promise<void> {
    this._cookies = await this._cookieStorage.load();

    const client = this._createHttpClient();
    await this._login(client);
  }

  // Identical to Python's _login
  private async _login(client: Got): Promise<void> {
    const authorization = await this._authorizationProvider.getAuthorization();
    this._cookies = {};
    this._cookieStorage.clear();
    // client.cookies.clear(); // got's cookieJar is automatically managed

    const authorized = await this._checkAuthorized(client);
    if (authorized) {
      return;
    }

    const tgtToken = await this._getTgtToken(client, authorization);
    await this._submitTgtToken(client, tgtToken);

    const authorizedAfter = await this._checkAuthorized(client);
    if (!authorizedAfter) {
      this.logger.error('Kakaolink Login: Unknown reason for login failure');
    }

    // self._cookies = dict(client.cookies) - extract cookies from got's cookieJar
    // got's cookieJar is automatically managed, no need for separate storage
    await this._cookieStorage.save(this._cookies);
  }

  // Identical to Python's _solve_two_factor_auth
  private async _solveTwoFactorAuth(
    client: Got,
    tfaHtml: string
  ): Promise<string> {
    try {
      const propsMatch = tfaHtml.match(
        /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s
      );
      if (!propsMatch) {
        throw new Error('Props not found');
      }

      const props = JSON.parse(propsMatch[1].trim());
      const context = props['props']['pageProps']['pageContext']['context'];
      const commonContext =
        props['props']['pageProps']['pageContext']['commonContext'];

      const token = context['token'];
      const continueUrl = context['continueUrl'];
      const csrf = commonContext['_csrf'];

      await this._confirmToken(client, token);

      const response = await client.post(
        'https://accounts.kakao.com/api/v2/talk_tms_auth/poll_from_service.json',
        {
          headers: { ...this._getWebHeaders() },
          json: {
            _csrf: csrf,
            token: token,
          },
        }
      );

      const resJson = JSON.parse(response.body);
      const status = resJson['status'];

      if (status !== 0) {
        throw new KakaoLink2FAException();
      }

      return continueUrl;
    } catch (error) {
      throw new KakaoLink2FAException();
    }
  }

  // Identical to Python's _confirm_token
  private async _confirmToken(
    client: Got,
    twoFactorToken: string
  ): Promise<void> {
    const response = await client.get('https://auth.kakao.com/fa/main.html', {
      searchParams: {
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
    });

    try {
      const csrfMatch = response.body.match(
        /<meta name="csrf-token" content="([^"]+)"/
      );
      if (!csrfMatch) {
        throw new Error('CSRF token not found');
      }
      const csrf = csrfMatch[1].trim();

      const optionsMatch = response.body.match(/var options = ({.*?});/s);
      if (!optionsMatch) {
        throw new Error('Options data not found');
      }
      const data = JSON.parse(optionsMatch[1].trim());

      const confirmResponse = await client.post(
        'https://auth.kakao.com/talk_tms_auth/confirm_token.json',
        {
          form: {
            client_id: data['client_id'],
            lang: 'ko',
            os: 'android',
            v: KAKAOTALK_VERSION,
            webview_v: '2',
            token: data['additionalAuthToken'],
            talk_tms_auth_type: 'from_service',
            authenticity_token: csrf,
          },
        }
      );

      const resJson = JSON.parse(confirmResponse.body);
      const status = resJson['status'];

      if (status !== 0) {
        throw new KakaoLink2FAException();
      }
    } catch (error) {
      throw new KakaoLink2FAException();
    }
  }

  // Identical to Python's _check_authorized
  private async _checkAuthorized(client: Got): Promise<boolean> {
    const response = await client.get('https://e.kakao.com/api/v1/users/me', {
      headers: {
        ...this._getWebHeaders(),
        referer: 'https://e.kakao.com/',
      },
    });

    const resJson = JSON.parse(response.body);
    const result = resJson['result'] || {};

    return result['status'] === 'VALID';
  }

  // Identical to Python's _submit_tgt_token
  private async _submitTgtToken(client: Got, tgtToken: string): Promise<void> {
    const response = await client.get('https://e.kakao.com', {
      headers: {
        ...this._getWebHeaders(),
        'ka-tgt': tgtToken,
      },
    });

    if (response.statusCode >= 400) {
      throw new KakaoLinkLoginException();
    }
  }

  // Identical to Python's _get_tgt_token
  private async _getTgtToken(client: Got, token: string): Promise<string> {
    const response = await client.post(
      'https://api-account.kakao.com/v1/auth/tgt',
      {
        headers: { ...this._getAppHeaders(token) },
        form: {
          key_type: 'talk_session_info',
          key: token,
          referer: 'talk',
        },
      }
    );

    const resJson = JSON.parse(response.body);

    if (resJson['code'] !== 0) {
      throw new KakaoLinkLoginException();
    }

    return resJson['token'];
  }

  // Identical to Python's _get_ka
  private _getKa(origin: string): string {
    return `sdk/1.43.5 os/javascript sdk_type/javascript lang/ko-KR device/Linux armv7l origin/${encodeURIComponent(origin)}`;
  }

  // Identical to Python's _get_app_headers
  private _getAppHeaders(token: string): Record<string, string> {
    return {
      A: `android/${KAKAOTALK_VERSION}/ko`,
      C: uuid4(),
      'User-Agent': `KT/${KAKAOTALK_VERSION} An/13 ko`,
      Authorization: token,
    };
  }

  // Identical to Python's _get_web_headers
  private _getWebHeaders(): Record<string, string> {
    return {
      'User-Agent': `${ANDROID_WEBVIEW_UA} KAKAOTALK/${KAKAOTALK_VERSION} (INAPP)`,
      'X-Requested-With': 'com.kakao.talk',
    };
  }

  // Same role as Python's httpx.AsyncClient(cookies=self._cookies)
  private _createHttpClient(): Got {
    const cookieJar = new CookieJar();

    // Set existing cookies to cookieJar
    Object.entries(this._cookies).forEach(([key, value]) => {
      try {
        cookieJar.setCookieSync(`${key}=${value}`, 'https://sharer.kakao.com');
      } catch (error) {
        // 쿠키 설정 실패 시 무시
      }
    });

    return got.extend({
      cookieJar: cookieJar,
      followRedirect: false, // false because we handle redirects manually
      maxRedirects: 0,
      timeout: {
        request: 30000,
      },
      throwHttpErrors: false,
      // Don't set prefixUrl - only use absolute URLs
      hooks: {
        afterResponse: [
          (response: any) => {
            // Update cookies from response (same as Python's automatic cookie management)
            const setCookies = response.headers['set-cookie'];
            if (setCookies) {
              setCookies.forEach((cookie: string) => {
                const [nameValue] = cookie.split(';');
                const [name, value] = nameValue.split('=');
                if (name && value) {
                  this._cookies[name.trim()] = value.trim();
                }
              });
            }
            return response;
          },
        ],
      },
    });
  }
}

// Alias for compatibility
export const IrisLink = KakaoLink;
