![logo](https://raw.githubusercontent.com/kyutai-labs/invincible-voice/refs/heads/main/images/logo.png)


InvincibleVoice (formerly Unmute) is a real-time voice communication system
designed to help people who cannot speak communicate naturally with others. The
system uses speech-to-text (STT), language models, and text-to-speech (TTS)
technology to enable fluid conversations.

Get more context about this project on [our official page](https://www.invincible-voice.com/).

## How it works

It is very similar to the [Unmute project](https://github.com/kyutai-labs/unmute), the main difference is that instead of having a TTS read whatever the LLM answers, we ask the LLM to provide multiple possible answers and the TTS will only play the answer selected by the user.

Of course the app has more features than just this, but this is the core idea.

## 🚀 Getting Started

We want to provide an free online demo at some point in the future, but for the moment, the only way try the project is to run it locally.
We have two ways of doing this, we recommend starting with the Gradium + Cerebras option as it is easier to set up, and moving to the fully self-hosted option (Kyutai TTS/STT + vLLM) once you are more confortable with the project:

### Using Gradium for TTS, STT and using an OpenAI compatible LLM service

This is the easiest way to get started since it doesn't require a GPU nor much setup.

#### The LLM service

For the LLM, we recommend grabbing a key from [Cerebras](https://www.cerebras.ai/) the reason we recommend Cerebras is that they have a very low latency and high throughput API, which is great for fast suggestions in the InvincibleVoice UI. The free tier is enough to get you started.
We recommend:
```
export KYUTAI_LLM_URL=https://api.cerebras.ai/v1
export KYUTAI_LLM_MODEL=qwen-3-235b-a22b-instruct-2507
export KYUTAI_LLM_API_KEY=<your_cerebras_api_key>
```

Of course anything else works as long as it is OpenAI compatible. Latency and throughput are important here to have a fluid experience, keep that in mind when choosing your provider and model.

#### The audio services

You can use [Gradium](https://gradium.ai/) for TTS and STT, as well as any LLM provider for the LLM api. This is the easiest way to get started as it requires less setup.

Concerning the TTS and STT, grab an api key from Gradium, the free tier should be enough to get you started.

Then you need to set the following environment variables:
```
export GRADIUM_API_KEY=<your_gradium_api_key>
export TTS_VOICE_ID=<desired_voice_id_it_is_optional>
export TTS_SERVER=https://eu.api.gradium.ai/api/
export TTS_IS_GRADIUM=true
export KYUTAI_STT_URL=wss://eu.api.gradium.ai/api/speech/asr
export STT_IS_GRADIUM=true
```

and then
```
docker compose up
```

### Using a text-to-speech and speech-to-text from Kyutai as well as a self-hosted LLM

If you have enough compute power, you can run the entire stack locally. This has the advantage of complete privacy and completely owning your stack and data but is more involved. This is nice for commercial use.

#### The LLM service

We recommend using [vLLM](https://docs.vllm.ai/en/stable/) or an equivalent llm engine.
The environment variables you need to set are:
```
export KYUTAI_LLM_URL=http://localhost:8000
export KYUTAI_LLM_MODEL=qwen-3-235b-a22b-instruct-2507  # or similar
```

#### The audio services

You'll need to set up both a TTS server and a STT server from Kyutai. For the moment we only support the server of [Delayed Stream Modelling](https://github.com/kyutai-labs/delayed-streams-modeling).

Then you need to set the following environment variables:
```
export STT_IS_GRADIUM=false
export TTS_IS_GRADIUM=false
export TTS_SERVER=<your_tts_server_url>
export KYUTAI_STT_URL=<your_stt_server_url>
export KYUTAI_API_KEY=<your_kyutai_api_key>
```

You can then start the project with docker:
```
docker compose up
```


### Getting involved with the project

We welcome contributions from everyone! Whether you're a seasoned developer or new to open source, there are many ways to get involved. We recommend heading to [the issues page](https://github.com/kyutai-labs/invincible-voice/issues) to see what needs to be done. When we see that something is a good fit for the project, we'll tag it with the "Help wanted" label. Issues that can be done by newcomers will be tagged with the "Good first issue" label. Also don't hesitate to open issues yourself if you see something that could be improved or if you have ideas for new features.
