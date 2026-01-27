![logo](https://raw.githubusercontent.com/kyutai-labs/invincible-voice/refs/heads/main/images/logo.png)


InvincibleVoice is a real-time voice communication system
designed to help people who cannot speak communicate naturally with others. The
system uses speech-to-text (STT), large language model (LLM) and text-to-speech (TTS)
technologies to enable fluid conversations.

Get more context about this project on [our official page](https://www.invincible-voice.com/).

## How it works

It is very similar to the [Unmute project](https://github.com/kyutai-labs/unmute); The main difference is that, instead of having the TTS reads out whatever the LLM answers, we ask the LLM to provide multiple possible answers and the TTS only utters the one selected by the user. This experimental system has more features than just this, in particular in the ways the LLM can be personnalized and the UI allows additional guidance of its answers, but this is the core idea.

## 🚀 Getting Started

We plan to open soon an online version of the system, with TTS freely provived by Gradium. In the meantime, we explain below how to insall and run it locally, for developpers to start exploring it right away. 

We provide two ways of doing this (see below); we recommend starting with the Gradium STT/TTS + Cerebras LLM option, as it is easier to set up, and moving to the fully self-hosted option (Kyutai STT/TTS + vLLM) once you are more confortable with the project.

### Using Gradium for STT/TTS and an LLM service compatible with the OpenAI API

This is the easiest way to get started since it doesn't require a GPU nor much setup.

#### The LLM service

For the LLM, we recommend grabbing a key from [Cerebras](https://www.cerebras.ai/) as their service has a very low latency and high throughput API, which is great for fast suggestions in the InvincibleVoice UI. The free tier is enough to get you started.
We recommend:
```
export KYUTAI_LLM_URL=https://api.cerebras.ai/v1
export KYUTAI_LLM_MODEL=qwen-3-235b-a22b-instruct-2507
export KYUTAI_LLM_API_KEY=<your_cerebras_api_key>
```

Of course anything else works as long as it is OpenAI compatible. Latency and throughput are important here to have a fluid experience, keep that in mind when choosing your provider and model.

#### The audio services

You can use [Gradium](https://gradium.ai/) for STT and TTS by grabbing an API key from them, the free tier should be enough to get you started. Then you need to set the following environment variables:
```
export GRADIUM_API_KEY=<your_gradium_api_key>
export KYUTAI_STT_PROVIDER=gradium
export KYUTAI_STT_SERVER=wss://eu.api.gradium.ai/api/speech/asr
export KYUTAI_TTS_PROVIDER=gradium
export KYUTAI_TTS_VOICE_ID=<desired_voice_id_it_is_optional>
export KYUTAI_TTS_SERVER=https://eu.api.gradium.ai/api/
```

and then
```
docker compose up
```

### Using STT/TTS from Kyutai along with a self-hosted LLM

If you have enough compute power, you can run the entire stack locally. This has the advantage of complete privacy and complete ownership of stack and data, but is more involved. This is nice for commercial use.

#### The LLM service

We recommend using [vLLM](https://docs.vllm.ai/en/stable/) or an equivalent LLM engine.
The environment variables you need to set are:
```
export KYUTAI_LLM_URL=http://localhost:8000
export KYUTAI_LLM_MODEL=qwen-3-235b-a22b-instruct-2507  # or similar
```

#### The audio services

You’ll need to set up both STT and TTS servers from Kyutai.
For STT, we only support the [Delayed Stream Modelling](https://github.com/kyutai-labs/delayed-streams-modeling) server for the moment.
For TTS, we support both the [Delayed Stream Modelling](https://github.com/kyutai-labs/delayed-streams-modeling) and [Pocket TTS](https://github.com/kyutai-labs/pocket-tts) servers. If you don’t set up a TTS server, the Python API of [Pocket TTS](https://github.com/kyutai-labs/pocket-tts) will be used automatically.
Then, you need to set the following environment variables:

```
export KYUTAI_STT_PROVIDER=dsm
export KYUTAI_STT_SERVER=<your_stt_server_url>
export KYUTAI_TTS_PROVIDER=<pocket/dsm>
export KYUTAI_TTS_SERVER=<your_tts_server_url_optional_with_pocket>
export KYUTAI_TTS_VOICE_ID=<desired_voice_id_it_is_optional>
export KYUTAI_API_KEY=<your_kyutai_api_key>
```

You can then start the project with docker:
```
docker compose up
```


### Getting involved with the project

We welcome contributions from everyone! Whether you're a seasoned developer or new to open source, there are many ways to get involved. We recommend heading to [the issues page](https://github.com/kyutai-labs/invincible-voice/issues) to see what needs to be done. When we see that something is a good fit for the project, we'll tag it with the "Help wanted" label. Issues that can be done by newcomers will be tagged with the "Good first issue" label. Also don't hesitate to open issues yourself if you see something that could be improved or if you have ideas for new features.
