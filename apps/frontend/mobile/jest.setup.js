import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

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
  openDatabaseSync: jest.fn(() => ({
    execAsync: jest.fn(async () => undefined),
    runAsync: jest.fn(async () => ({ changes: 1, lastInsertRowId: 0 })),
    getAllAsync: jest.fn(async () => []),
  })),
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
