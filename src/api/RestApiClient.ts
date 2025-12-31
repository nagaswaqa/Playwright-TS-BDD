import { APIRequestContext, APIResponse } from '@playwright/test';

export class RestApiClient {
    constructor(private request: APIRequestContext) { }

    async get(endpoint: string, headers?: Record<string, string>): Promise<APIResponse> {
        return await this.request.get(endpoint, { headers });
    }

    async post(endpoint: string, data: any, headers?: Record<string, string>): Promise<APIResponse> {
        return await this.request.post(endpoint, { data, headers });
    }

    async put(endpoint: string, data: any, headers?: Record<string, string>): Promise<APIResponse> {
        return await this.request.put(endpoint, { data, headers });
    }

    async patch(endpoint: string, data: any, headers?: Record<string, string>): Promise<APIResponse> {
        return await this.request.patch(endpoint, { data, headers });
    }

    async delete(endpoint: string, headers?: Record<string, string>): Promise<APIResponse> {
        return await this.request.delete(endpoint, { headers });
    }
}
