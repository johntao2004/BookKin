package io.github.johntao2004.bookkin.auth;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class PasswordPolicyServiceTest {
 @Test void enforcesEveryEnabledRequirementAndLength() {
  var strict=new PasswordPolicyService.Policy(12,true,true,true,true);
  for(String value:new String[]{"short1!A","lowercaseonly1!","UPPERCASEONLY1!","NoDigitsAtAll!","NoSymbolsHere123","A1中文中文中文中文中文a","A1          a"})
   assertThrows(RuntimeException.class,()->PasswordPolicyService.validate(value,strict));
  assertDoesNotThrow(()->PasswordPolicyService.validate("Strong-Password1!",strict));
  assertThrows(RuntimeException.class,()->PasswordPolicyService.validate("Aa1!"+"x".repeat(197),strict));
 }
 @Test void disabledRequirementsAndConfiguredMinimumAreRespected() {
  var relaxed=new PasswordPolicyService.Policy(8,false,false,false,false);
  assertDoesNotThrow(()->PasswordPolicyService.validate("abcdefgh",relaxed));
  assertThrows(RuntimeException.class,()->PasswordPolicyService.validate("abcdefg",relaxed));
  assertThrows(RuntimeException.class,()->PasswordPolicyService.validate(null,relaxed));
 }
 @Test void generatedTemporaryPasswordsRespectHighMinimumAndAllCategories() {
  var service=spy(new PasswordPolicyService(null,null,null));
  var strict=new PasswordPolicyService.Policy(128,true,true,true,true);doReturn(strict).when(service).policy();
  for(int i=0;i<20;i++) assertDoesNotThrow(()->PasswordPolicyService.validate(service.temporaryPassword(),strict));
 }
}
