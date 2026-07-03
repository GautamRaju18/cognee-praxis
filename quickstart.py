import asyncio

import cognee


async def main():
    await cognee.forget(everything=True)

    text = "Cognee turns documents into AI memory."
    await cognee.remember(text)

    results = await cognee.recall(query_text="What does Cognee do?")
    for result in results:
        print(result.text)


if __name__ == "__main__":
    asyncio.run(main())
