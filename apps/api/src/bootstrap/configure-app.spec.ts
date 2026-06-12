import { configureApp } from './configure-app'

describe('configureApp', () => {
  it('registers checkout rate limiting, validation and API prefix', () => {
    const app = {
      use: jest.fn(),
      useGlobalPipes: jest.fn(),
      setGlobalPrefix: jest.fn(),
    }

    configureApp(app as never)

    expect(app.use).toHaveBeenCalledWith(
      '/api/commandes/checkout',
      expect.any(Function),
    )
    expect(app.useGlobalPipes).toHaveBeenCalledWith(expect.any(Object))
    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api')
  })
})
