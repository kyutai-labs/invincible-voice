const ReadyState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

const mockWebSocket = {
  sendMessage: jest.fn(),
  lastMessage: null,
  readyState: ReadyState.OPEN,
};

const useWebSocket = jest.fn(() => mockWebSocket);

useWebSocket.ReadyState = ReadyState;

export default useWebSocket;
export { ReadyState };
