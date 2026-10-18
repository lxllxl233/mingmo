import { loadContentFromDirectory } from '../src/content/loader/node';

try {
  const content = loadContentFromDirectory();
  console.log(`regions=${content.regions.size}`);
  console.log(`prefectures=${content.prefectures.size}`);
  console.log(`provinces=${content.provinces.size}`);
  console.log(`countries=${content.countries.size}`);
  console.log(`estates=${content.estateDefs.size}`);
  console.log(`taxLaws=${content.taxLaws.size}`);
  console.log(`privileges=${content.privileges.size}`);
  console.log(`focuses=${content.focuses.size}`);
  console.log(`events=${content.events.size}`);
  console.log(`eventChains=${content.eventChains.size}`);
  console.log(`techs=${content.techs.size}`);
  console.log(`decisions=${content.decisions.size}`);
  console.log(`generals=${content.generals.size}`);
  console.log(`scenarios=${content.scenarios.size}`);
  console.log('validate: ok');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
