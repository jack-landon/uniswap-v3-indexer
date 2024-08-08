import assert from "assert";
import { 
  TestHelpers,
  UniswapV3Factory_FeeAmountEnabled
} from "generated";
const { MockDb, UniswapV3Factory } = TestHelpers;

describe("UniswapV3Factory contract FeeAmountEnabled event tests", () => {
  // Create mock db
  const mockDb = MockDb.createMockDb();

  // Creating mock for UniswapV3Factory contract FeeAmountEnabled event
  const event = UniswapV3Factory.FeeAmountEnabled.createMockEvent({/* It mocks event fields with default values. You can overwrite them if you need */});

  it("UniswapV3Factory_FeeAmountEnabled is created correctly", async () => {
    // Processing the event
    const mockDbUpdated = await UniswapV3Factory.FeeAmountEnabled.processEvent({
      event,
      mockDb,
    });

    // Getting the actual entity from the mock database
    let actualUniswapV3FactoryFeeAmountEnabled = mockDbUpdated.entities.UniswapV3Factory_FeeAmountEnabled.get(
      `${event.transactionHash}_${event.logIndex}`
    );

    // Creating the expected entity
    const expectedUniswapV3FactoryFeeAmountEnabled: UniswapV3Factory_FeeAmountEnabled = {
      id: `${event.transactionHash}_${event.logIndex}`,
      fee: event.params.fee,
      tickSpacing: event.params.tickSpacing,
    };
    // Asserting that the entity in the mock database is the same as the expected entity
    assert.deepEqual(actualUniswapV3FactoryFeeAmountEnabled, expectedUniswapV3FactoryFeeAmountEnabled, "Actual UniswapV3FactoryFeeAmountEnabled should be the same as the expectedUniswapV3FactoryFeeAmountEnabled");
  });
});
