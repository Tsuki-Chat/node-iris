import { addAliases } from 'module-alias';
import 'module-alias/register';

addAliases({
  '@': __dirname,
  '@types': __dirname + '/types',
  '@utils': __dirname + '/utils',
  '@services': __dirname + '/services',
  '@decorators': __dirname + '/decorators',
  '@controllers': __dirname + '/controllers',
});
