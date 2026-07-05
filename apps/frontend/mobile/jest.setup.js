import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

// Pin the device locale to English so i18n resolves the English catalog under
// test (the source language of the app's copy).
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en' }],
}));

jest.mock('expo-auth-session/providers/google', () => ({
  useIdTokenAuthRequest: jest.fn(() => [
    {
      url: 'https://accounts.google.com/o/oauth2/v2/auth',
    },
    null,
    jest.fn(async () => ({ type: 'dismiss' })),
  ]),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  warmUpAsync: jest.fn(async () => undefined),
  coolDownAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => {
    const db = {
      execAsync: jest.fn(async () => undefined),
      runAsync: jest.fn(async () => ({ changes: 1, lastInsertRowId: 0 })),
      getAllAsync: jest.fn(async () => []),
      withExclusiveTransactionAsync: jest.fn(async (task) => {
        await task(db);
      }),
    };
    return db;
  }),
}));

jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const React = require('react');

  function renderComponent(Component) {
    if (!Component) return null;
    if (React.isValidElement(Component)) return Component;
    return React.createElement(Component);
  }

  function FlatList({
    data = [],
    keyExtractor,
    renderItem,
    ListEmptyComponent,
    contentContainerStyle,
  }) {
    const items = Array.isArray(data) ? data : [];
    return React.createElement(
      'View',
      { style: contentContainerStyle },
      items.length === 0
        ? renderComponent(ListEmptyComponent)
        : items.map((item, index) =>
            React.createElement(
              React.Fragment,
              { key: keyExtractor ? keyExtractor(item, index) : String(index) },
              renderItem({
                item,
                index,
                separators: {
                  highlight: jest.fn(),
                  unhighlight: jest.fn(),
                  updateProps: jest.fn(),
                },
              })
            )
          )
    );
  }

  return {
    __esModule: true,
    default: FlatList,
  };
});

// Initialize i18next once per test file so components that call useTranslation
// resolve the catalogs even when rendered in isolation (not via the app entry).
require('./src/lib/i18n');
