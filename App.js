import React from "react";
import {
  Button,
  TextInput,
  AsyncStorage,
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  FlatList,
  Keyboard
} from "react-native";
import Dropbox from "dropbox";
import { AuthSession } from "expo";

const DROPBOX_APP_ID = "x1vpgttqmls8oco";
const ASYNC_STORAGE_KEY = "dropboxAccessToken";
const DELIMITER = "\n\n----------\n\n";

export default class App extends React.Component {
  state = {
    accessToken: null,
    isLoading: true,
    isSendingMessage: false,
    errorMessage: null,
    inputText: null,
    notes: []
  };

  async componentWillMount() {
    let accessToken = await AsyncStorage.getItem(ASYNC_STORAGE_KEY);
    this.setState({
      accessToken,
      isLoading: false
    });
    if (accessToken) {
      this._createDropboxObject(accessToken);
    }

    Keyboard.addListener("keyboardDidShow", this._keyboardDidShow);
  }

  render() {
    let {
      accessToken,
      isLoading,
      errorMessage,
      notes,
      isSendingMessage,
      inputText
    } = this.state;

    if (isLoading) {
      return <View />;
    }

    if (accessToken) {
      return (
        <KeyboardAvoidingView
          style={styles.container}
          behavior="padding"
          enabled
        >
          <View
            style={{
              flex: 1,
              borderBottomWidth: 1,
              borderBottomColor: "#777777",
              paddingTop: 25,
              marginBottom: 10,
              width: "100%"
            }}
          >
            <FlatList
              data={notes}
              renderItem={({ item }) => (
                <Text
                  selectable
                  style={{
                    paddingBottom: 10,
                    paddingLeft: 40,
                    paddingRight: 40
                  }}
                >
                  {item.value}
                </Text>
              )}
              ref={ref => (this._scrollView = ref)}
              onContentSizeChange={(contentWidth, contentHeight) => {
                this._scrollView.scrollToEnd({ animated: true });
              }}
            />
          </View>
          <View style={{ flexDirection: "row" }}>
            <TextInput
              autoFocus
              autoCorrect={false}
              multiline
              onChangeText={inputText => this.setState({ inputText })}
              value={inputText}
              style={{ height: 40, width: 250 }}
            />
            <Button
              onPress={this._onSendAsync}
              title="Send"
              color="#841584"
              disabled={isSendingMessage}
            />
          </View>
        </KeyboardAvoidingView>
      );
    } else {
      return (
        <View style={styles.container}>
          <Button title="Login to Dropbox" onPress={this._loginAsync} />
          {errorMessage && <Text>{errorMessage}</Text>}
        </View>
      );
    }
  }

  _keyboardDidShow = () => {
    setTimeout(() => {
      if (this._scrollView) {
        this._scrollView.scrollToEnd({ animated: false });
      }
    }, 100);
  };

  _createDropboxObject = async accessToken => {
    this._dropbox = new Dropbox.Dropbox({ accessToken });
    this._setFileContents(await this._getRemoteFileContentsAsync());
  };

  _setFileContents = contents => {
    let key = 0;
    this.setState({
      notes: contents
        .split(DELIMITER)
        .reverse()
        .map(item => {
          return {
            key: "" + key++,
            value: item
          };
        })
    });
  };

  _getRemoteFileContentsAsync = async () => {
    let file = await this._dropbox.filesGetTemporaryLink({
      path: "/notes_log.txt"
    });
    let link = file.link;
    let fetchResponse = await fetch(link);
    return await fetchResponse.text();
  };

  _onSendAsync = async () => {
    let content = this.state.inputText;
    this.setState({
      inputText: "",
      isSendingMessage: true
    });

    try {
      let oldText = await this._getRemoteFileContentsAsync();

      let newFile = content + DELIMITER + oldText;
      await this._dropbox.filesUpload({
        contents: new File([newFile], "notes_log.txt", {
          type: "text/plain"
        }),
        path: "/notes_log.txt",
        mode: {
          ".tag": "overwrite"
        },
        autorename: false,
        mute: true
      });

      this._setFileContents(newFile);

      this.setState({
        isSendingMessage: false
      });
    } catch (e) {
      this.setState({
        inputText: content,
        isSendingMessage: false
      });
    }
  };

  _loginAsync = async () => {
    this.setState({
      errorMessage: null
    });

    let dropbox = new Dropbox.Dropbox({ clientId: DROPBOX_APP_ID });
    let redirectUrl = AuthSession.getRedirectUrl();
    let result = await AuthSession.startAsync({
      authUrl: dropbox.getAuthenticationUrl(redirectUrl)
    });

    if (result.type === "success") {
      let accessToken = result.params.access_token;
      await AsyncStorage.setItem(ASYNC_STORAGE_KEY, accessToken);
      this.setState({ accessToken });
      this._createDropboxObject(accessToken);
    } else {
      this.setState({
        errorMessage: "Could not login to Dropbox. Please try again."
      });
    }
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  }
});
