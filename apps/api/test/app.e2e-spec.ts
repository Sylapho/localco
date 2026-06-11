import request from 'supertest'
import { createTestApp, E2eTestApp } from './helpers/create-test-app'

describe('AppController (e2e)', () => {
  let testApp: E2eTestApp

  beforeAll(async () => {
    testApp = await createTestApp()
  })

  it('/api (GET)', () => {
    return request(testApp.app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!')
  })

  afterAll(async () => {
    await testApp.app.close()
  })
})
