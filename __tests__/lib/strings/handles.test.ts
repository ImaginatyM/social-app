import {type IsValidHandle, validateServiceHandle} from '#/lib/strings/handles'

describe('handle validation', () => {
  const valid = [
    ['ali', 'tellus.social'],
    ['alice', 'tellus.social'],
    ['a-lice', 'tellus.social'],
    ['a-----lice', 'tellus.social'],
    ['123', 'tellus.social'],
    ['123456789012345678', 'tellus.social'],
    ['alice', 'custom-pds.com'],
    ['alice', 'my-custom-pds-with-long-name.social'],
    ['123456789012345678', 'my-custom-pds-with-long-name.social'],
  ]
  it.each(valid)(`should be valid: %s.%s`, (handle, service) => {
    const result = validateServiceHandle(handle, service)
    expect(result.overall).toEqual(true)
  })

  const invalid = [
    ['al', 'tellus.social', 'frontLengthNotTooShort'],
    ['-alice', 'tellus.social', 'hyphenStartOrEnd'],
    ['alice-', 'tellus.social', 'hyphenStartOrEnd'],
    ['%%%', 'tellus.social', 'handleChars'],
    ['1234567890123456789', 'tellus.social', 'frontLengthNotTooLong'],
    [
      '1234567890123456789',
      'my-custom-pds-with-long-name.social',
      'frontLengthNotTooLong',
    ],
    ['al', 'my-custom-pds-with-long-name.social', 'frontLengthNotTooShort'],
    ['a'.repeat(300), 'toolong.com', 'totalLength'],
  ] satisfies [string, string, keyof IsValidHandle][]
  it.each(invalid)(
    `should be invalid: %s.%s due to %s`,
    (handle, service, expectedError) => {
      const result = validateServiceHandle(handle, service)
      expect(result.overall).toEqual(false)
      expect(result[expectedError]).toEqual(false)
    },
  )
})
